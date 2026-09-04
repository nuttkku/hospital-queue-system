// 🗄️ ชั้นจัดการข้อมูล MariaDB — ตารางคิว + ตารางผู้ใช้ (RBAC)
// คอลัมน์ "seq" ในตาราง patients = ลำดับของคนไข้ภายในสถานะนั้น ๆ
// ใช้ตาราง queue_seq เป็นตัวนับ + transaction เพื่อกันเลขซ้ำ
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");

const DB_CONFIG = {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "queue_user",
    password: process.env.DB_PASSWORD || "queue_pass",
    database: process.env.DB_NAME || "hospital_queue",
    charset: "utf8mb4",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
};

// บทบาทที่ระบบรองรับ
const ROLES = ["admin", "receptionist", "doctor"];

const SCHEMA_STATEMENTS = [
    `CREATE TABLE IF NOT EXISTS patients (
        id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name       VARCHAR(200)    NOT NULL,
        status     ENUM('waiting','checking','done') NOT NULL DEFAULT 'waiting',
        seq        BIGINT UNSIGNED NOT NULL,
        created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_status_seq (status, seq)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS queue_seq (
        id  TINYINT UNSIGNED NOT NULL PRIMARY KEY,
        val BIGINT UNSIGNED  NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `INSERT IGNORE INTO queue_seq (id, val) VALUES (1, 0)`,
    `CREATE TABLE IF NOT EXISTS users (
        id              INT UNSIGNED  NOT NULL AUTO_INCREMENT,
        username        VARCHAR(50)   NOT NULL,
        password_hash   VARCHAR(255)  NOT NULL,
        name            VARCHAR(100)  NOT NULL,
        role            ENUM('admin','receptionist','doctor') NOT NULL DEFAULT 'receptionist',
        -- 2FA (TOTP): totp_enabled=0 บังคับให้เข้า flow ตั้งค่า 2FA ทุกครั้งที่ login
        totp_secret_enc TEXT          NULL,
        totp_enabled    TINYINT(1)    NOT NULL DEFAULT 0,
        created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_users_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
    `CREATE TABLE IF NOT EXISTS backup_codes (
        id         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id    INT UNSIGNED    NOT NULL,
        code_hash  VARCHAR(255)    NOT NULL,
        used_at    DATETIME        NULL,
        created_at TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_backup_codes_user (user_id),
        CONSTRAINT fk_backup_codes_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
];

// เติมคอลัมน์ 2FA ให้ตาราง users ที่สร้างไว้ก่อนหน้านี้ (กรณีอัปเกรดจากเวอร์ชันเก่า)
async function ensureUserTwoFaColumns() {
    for (const stmt of [
        "ALTER TABLE users ADD COLUMN totp_secret_enc TEXT NULL",
        "ALTER TABLE users ADD COLUMN totp_enabled TINYINT(1) NOT NULL DEFAULT 0",
    ]) {
        try {
            await getPool().query(stmt);
        } catch (err) {
            if (!err || err.code !== "ER_DUP_FIELDNAME") throw err;
        }
    }
}

let pool = null;
let ready = false;
const readyWaiters = [];

function getPool() {
    if (!pool) pool = mysql.createPool(DB_CONFIG);
    return pool;
}

function whenReady() {
    if (ready) return Promise.resolve();
    return new Promise((resolve) => readyWaiters.push(resolve));
}

// ---------- เตรียมฐานข้อมูล + seed บัญชีเริ่มต้น ----------
async function init() {
    const maxAttempts = Number(process.env.DB_CONNECT_ATTEMPTS || 30);
    const retryDelayMs = Number(process.env.DB_RETRY_DELAY_MS || 2000);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        let conn = null;
        try {
            conn = await getPool().getConnection();
            for (const sql of SCHEMA_STATEMENTS) {
                await conn.query(sql);
            }
            conn.release();
            conn = null;
            await ensureUserTwoFaColumns();
            await seedDefaultUsers();
            ready = true;
            readyWaiters.splice(0).forEach((resolve) => resolve());
            console.log("🗄️  เชื่อมต่อ MariaDB สำเร็จ และเตรียมตารางข้อมูลเรียบร้อย");
            return;
        } catch (err) {
            if (conn) {
                try { conn.release(); } catch { /* ไม่ต้องทำอะไร */ }
            }
            console.log(`⏳  ยังเชื่อมต่อ MariaDB ไม่ได้ (ครั้งที่ ${attempt}/${maxAttempts}): ${err.message}`);
            await new Promise((r) => setTimeout(r, retryDelayMs));
        }
    }
    throw new Error("ไม่สามารถเชื่อมต่อ MariaDB ได้ — ตรวจสอบว่า container db รันอยู่ (docker compose up -d db)");
}

// สร้างบัญชีตัวอย่างครั้งแรก (เฉพาะเมื่อยังไม่มีผู้ใช้ในระบบ)
async function seedDefaultUsers() {
    const [rows] = await getPool().query("SELECT COUNT(*) AS c FROM users");
    if (Number(rows[0].c) > 0) return;

    const defaults = [
        {
            username: process.env.SEED_ADMIN_USERNAME || "admin",
            password: process.env.SEED_ADMIN_PASSWORD || "admin123",
            name: "ผู้ดูแลระบบ",
            role: "admin",
        },
        {
            username: process.env.SEED_RECEPTIONIST_USERNAME || "receptionist",
            password: process.env.SEED_RECEPTIONIST_PASSWORD || "reception123",
            name: "เจ้าหน้าที่รับคิว",
            role: "receptionist",
        },
        {
            username: process.env.SEED_DOCTOR_USERNAME || "doctor",
            password: process.env.SEED_DOCTOR_PASSWORD || "doctor123",
            name: "แพทย์",
            role: "doctor",
        },
    ];

    for (const u of defaults) {
        const hash = bcrypt.hashSync(u.password, 10);
        await getPool().execute(
            "INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)",
            [u.username, hash, u.name, u.role]
        );
        console.log(`👤 สร้างบัญชีเริ่มต้น: ${u.username} (${u.role}) รหัสผ่าน: ${u.password}`);
    }
}

// ---------- ฟังก์ชันคิว ----------
function nextStatus(from) {
    if (from === "waiting") return "checking";
    if (from === "checking") return "done";
    return null;
}

// ดึงเลขลำดับถัดไป — UPDATE ล็อกแถว counter ป้องกันเลขซ้ำ
async function allocateSeq(conn) {
    await conn.execute("UPDATE queue_seq SET val = val + 1 WHERE id = 1");
    const [rows] = await conn.execute("SELECT val FROM queue_seq WHERE id = 1");
    return Number(rows[0].val);
}

async function getQueue() {
    const [rows] = await getPool().query(
        "SELECT status, name FROM patients ORDER BY seq ASC"
    );
    const result = { waiting: [], checking: [], done: [] };
    for (const row of rows) result[row.status].push(row.name);
    return result;
}

async function addPatient(name) {
    const conn = await getPool().getConnection();
    try {
        await conn.beginTransaction();
        const seq = await allocateSeq(conn);
        await conn.execute(
            "INSERT INTO patients (name, status, seq) VALUES (?, 'waiting', ?)",
            [name, seq]
        );
        await conn.commit();
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

async function movePatient(from, index) {
    const to = nextStatus(from);
    if (!to) {
        throw new Error("สถานะต้นทางไม่ถูกต้อง (ใช้ได้เฉพาะ waiting หรือ checking)");
    }
    const conn = await getPool().getConnection();
    try {
        await conn.beginTransaction();
        const [rows] = await conn.execute(
            "SELECT id, name FROM patients WHERE status = ? ORDER BY seq ASC",
            [from]
        );
        const i = Number(index);
        if (!Number.isInteger(i) || i < 0 || i >= rows.length) {
            throw new Error("ไม่พบรายการคิวในตำแหน่งที่เลือก (อาจถูกย้ายไปก่อนแล้ว)");
        }
        const target = rows[i];
        const seq = await allocateSeq(conn);
        await conn.execute(
            "UPDATE patients SET status = ?, seq = ? WHERE id = ?",
            [to, seq, target.id]
        );
        await conn.commit();
        return target.name;
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

async function clearWaiting() {
    await getPool().execute("DELETE FROM patients WHERE status = 'waiting'");
}

async function clearAll() {
    await getPool().execute("DELETE FROM patients");
}

// ---------- ฟังก์ชันผู้ใช้ (RBAC) ----------
function toSafeUser(row) {
    if (!row) return null;
    return {
        id: row.id,
        username: row.username,
        name: row.name,
        role: row.role,
        totpEnabled: Boolean(row.totp_enabled),
    };
}

// ดึงข้อมูลเต็มสำหรับ flow auth/2FA (รวม secret + สถานะ 2FA)
async function getAuthUser(id) {
    const [rows] = await getPool().execute(
        "SELECT id, username, password_hash, name, role, totp_secret_enc, totp_enabled FROM users WHERE id = ?",
        [id]
    );
    return rows[0] || null;
}

async function findUserById(id) {
    const [rows] = await getPool().execute(
        "SELECT id, username, name, role, totp_enabled FROM users WHERE id = ?",
        [id]
    );
    return toSafeUser(rows[0]);
}

async function findUserWithPassword(username) {
    const [rows] = await getPool().execute(
        "SELECT id, username, password_hash, name, role, totp_enabled FROM users WHERE username = ?",
        [username]
    );
    return rows[0] || null;
}

async function listUsers() {
    const [rows] = await getPool().query(
        "SELECT id, username, name, role, totp_enabled, created_at FROM users ORDER BY id ASC"
    );
    return rows.map((r) => ({ ...r, totp_enabled: Boolean(r.totp_enabled) }));
}

async function createUser({ username, name, password, role }) {
    const hash = bcrypt.hashSync(password, 10);
    const [result] = await getPool().execute(
        "INSERT INTO users (username, password_hash, name, role) VALUES (?, ?, ?, ?)",
        [username, hash, name, role]
    );
    return findUserById(result.insertId);
}

async function updateUser(id, { name, role, password }) {
    if (name !== undefined) {
        await getPool().execute("UPDATE users SET name = ? WHERE id = ?", [name, id]);
    }
    if (role !== undefined) {
        await getPool().execute("UPDATE users SET role = ? WHERE id = ?", [role, id]);
    }
    if (password) {
        const hash = bcrypt.hashSync(password, 10);
        await getPool().execute("UPDATE users SET password_hash = ? WHERE id = ?", [hash, id]);
    }
    return findUserById(id);
}

async function deleteUser(id) {
    await getPool().execute("DELETE FROM users WHERE id = ?", [id]);
}

async function countAdmins() {
    const [rows] = await getPool().query("SELECT COUNT(*) AS c FROM users WHERE role = 'admin'");
    return Number(rows[0].c);
}

// ---------- ฟังก์ชัน 2FA (TOTP) ----------
async function setTotpSecretPending(userId, encryptedSecret) {
    await getPool().execute(
        "UPDATE users SET totp_secret_enc = ?, totp_enabled = 0 WHERE id = ?",
        [encryptedSecret, userId]
    );
}

async function enableTotp(userId) {
    await getPool().execute("UPDATE users SET totp_enabled = 1 WHERE id = ?", [userId]);
}

// ล้าง 2FA (เช่น admin รีเซ็ต) — login ครั้งหน้าต้องตั้งค่าใหม่เสมอ
async function resetTwoFa(userId) {
    await clearBackupCodes(userId);
    await getPool().execute(
        "UPDATE users SET totp_secret_enc = NULL, totp_enabled = 0 WHERE id = ?",
        [userId]
    );
}

// ---------- Backup codes (เก็บเฉพาะ hash เหมือนรหัสผ่าน) ----------
async function clearBackupCodes(userId) {
    await getPool().execute("DELETE FROM backup_codes WHERE user_id = ?", [userId]);
}

async function insertBackupCodes(userId, hashedCodes) {
    for (const hash of hashedCodes) {
        await getPool().execute(
            "INSERT INTO backup_codes (user_id, code_hash) VALUES (?, ?)",
            [userId, hash]
        );
    }
}

async function getUnusedBackupCodes(userId) {
    const [rows] = await getPool().execute(
        "SELECT id, code_hash FROM backup_codes WHERE user_id = ? AND used_at IS NULL",
        [userId]
    );
    return rows;
}

async function markBackupCodeUsed(id) {
    await getPool().execute("UPDATE backup_codes SET used_at = NOW() WHERE id = ?", [id]);
}

async function close() {
    if (pool) {
        await pool.end();
        pool = null;
        ready = false;
    }
}

module.exports = {
    init,
    whenReady,
    nextStatus,
    ROLES,
    // คิว
    getQueue,
    addPatient,
    movePatient,
    clearWaiting,
    clearAll,
    // ผู้ใช้
    toSafeUser,
    getAuthUser,
    findUserById,
    findUserWithPassword,
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    countAdmins,
    // 2FA
    setTotpSecretPending,
    enableTotp,
    resetTwoFa,
    clearBackupCodes,
    insertBackupCodes,
    getUnusedBackupCodes,
    markBackupCodeUsed,
    // ปิดระบบ
    close,
};


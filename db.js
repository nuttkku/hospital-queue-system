// 🗄️ ชั้นจัดการข้อมูล MariaDB — แทนที่การอ่าน/เขียนไฟล์ .txt เดิม
// โครงสร้าง: ตาราง patients เก็บคนไข้ทุกสถานะ (waiting/checking/done)
// คอลัมน์ "seq" = ลำดับของคนไข้ภายในสถานะนั้น ๆ (เพิ่มขึ้นทุกครั้งที่คนไข้เข้าสถานะ)
// → ได้พฤติกรรมเหมือนเดิมกับตอนเขียนไฟล์ (เพิ่ม/ย้าย = ต่อท้ายคอลัมน์ปลายทางเสมอ)
// ใช้ตาราง queue_seq เป็นตัวนับ + ทำงานใน transaction เพื่อกันเลขซ้ำเมื่อมีการใช้งานพร้อมกัน
const mysql = require("mysql2/promise");

// ตั้งค่าผ่าน environment (docker-compose จะส่งให้อัตโนมัติ)
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

// เตรียมโครงสร้างตาราง (รันตอน boot — database ถูกสร้างโดย docker-compose แล้ว)
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
];

let pool = null;
let ready = false;
const readyWaiters = [];

function getPool() {
    if (!pool) pool = mysql.createPool(DB_CONFIG);
    return pool;
}

// รอจนกระทั่ง DB พร้อมใช้ (กรณีโค้ดอื่นเรียกก่อน init เสร็จ)
function whenReady() {
    if (ready) return Promise.resolve();
    return new Promise((resolve) => readyWaiters.push(resolve));
}

// สถานะถัดไปในสายพาน: waiting -> checking -> done
function nextStatus(from) {
    if (from === "waiting") return "checking";
    if (from === "checking") return "done";
    return null;
}

// ดึงเลขลำดับถัดไป — UPDATE ล็อกแถว counter ทำให้เลขไม่ซ้ำกันแม้เรียกพร้อมกัน
async function allocateSeq(conn) {
    await conn.execute("UPDATE queue_seq SET val = val + 1 WHERE id = 1");
    const [rows] = await conn.execute("SELECT val FROM queue_seq WHERE id = 1");
    return Number(rows[0].val);
}

// ---------- เริ่มต้นระบบ: สร้างตาราง + ลองเชื่อมต่อใหม่จนกว่าจะสำเร็จ ----------
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

// ---------- อ่านสถานะทั้งหมด: { waiting: [...], checking: [...], done: [...] } ----------
async function getQueue() {
    const [rows] = await getPool().query(
        "SELECT status, name FROM patients ORDER BY seq ASC"
    );
    const result = { waiting: [], checking: [], done: [] };
    for (const row of rows) {
        result[row.status].push(row.name);
    }
    return result;
}

// ---------- เพิ่มคิวใหม่ (สถานะ: รอตรวจ) ----------
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

// ---------- เลื่อนสถานะ: waiting -> checking -> done ----------
async function movePatient(from, index) {
    const to = nextStatus(from);
    if (!to) {
        throw new Error("สถานะต้นทางไม่ถูกต้อง (ใช้ได้เฉพาะ waiting หรือ checking)");
    }

    const conn = await getPool().getConnection();
    try {
        await conn.beginTransaction();

        // หาคนไข้ตำแหน่ง index ในคอลัมน์ต้นทาง (เรียงตามลำดับที่เข้าคอลัมน์)
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

// ---------- ล้างคิวที่รอตรวจเท่านั้น ----------
async function clearWaiting() {
    await getPool().execute("DELETE FROM patients WHERE status = 'waiting'");
}

// ---------- ล้างข้อมูลทุกสถานะ ----------
async function clearAll() {
    await getPool().execute("DELETE FROM patients");
}

// ---------- ปิดการเชื่อมต่อทั้งหมด (ตอนปิด container) ----------
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
    getQueue,
    addPatient,
    movePatient,
    clearWaiting,
    clearAll,
    close,
    nextStatus,
};


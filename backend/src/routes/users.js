// 👥 Routes: จัดการผู้ใช้ (admin เท่านั้น)
const express = require("express");
const db = require("../db");
const { requireAuth, allowRoles } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();
const adminOnly = [requireAuth, allowRoles("admin")];

function validateRole(role) {
    return db.ROLES.includes(role) ? role : null;
}

// GET /api/users
router.get("/", adminOnly, asyncHandler(async (req, res) => {
    return res.json({ users: await db.listUsers() });
}));

// POST /api/users — สร้างผู้ใช้ใหม่
router.post("/", adminOnly, asyncHandler(async (req, res) => {
    const username = String((req.body && req.body.username) || "").trim().toLowerCase();
    const name = String((req.body && req.body.name) || "").trim().slice(0, 100);
    const password = String((req.body && req.body.password) || "");
    const role = validateRole(req.body && req.body.role);

    if (!username || !name || !password || !role) {
        return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบ (ชื่อผู้ใช้, ชื่อ-นามสกุล, รหัสผ่าน, บทบาท)" });
    }
    if (!/^[a-z0-9_.-]{3,50}$/.test(username)) {
        return res.status(400).json({ error: "ชื่อผู้ใช้ต้องเป็นตัวอักษร/ตัวเลข 3-50 ตัว (a-z, 0-9, _, ., -)" });
    }
    if (password.length < 4) {
        return res.status(400).json({ error: "รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร" });
    }

    try {
        const user = await db.createUser({ username, name, password, role });
        console.log(`👤 ${req.user.username} สร้างผู้ใช้: ${username} (${role})`);
        await db.logActivity({ userId: req.user.id, username: req.user.username, action: "เพิ่มผู้ใช้", detail: `${username} (${role})`, ip: req.ip });
        return res.json({ user });
    } catch (err) {
        if (err && err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ error: "ชื่อผู้ใช้นี้มีอยู่แล้วในระบบ" });
        }
        throw err;
    }
}));

// PUT /api/users/:id — แก้ไขชื่อ / บทบาท / รหัสผ่าน
router.put("/:id", adminOnly, asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "id ไม่ถูกต้อง" });
    }
    const target = await db.findUserById(id);
    if (!target) {
        return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    }

    const body = req.body || {};
    const patch = {};
    if (body.name !== undefined) {
        const name = String(body.name).trim().slice(0, 100);
        if (!name) return res.status(400).json({ error: "ชื่อ-นามสกุลห้ามว่าง" });
        patch.name = name;
    }
    if (body.role !== undefined) {
        const role = validateRole(body.role);
        if (!role) return res.status(400).json({ error: "บทบาทไม่ถูกต้อง" });
        // กันการถอดบทบาท admin คนสุดท้าย
        if (target.role === "admin" && role !== "admin" && (await db.countAdmins()) <= 1) {
            return res.status(400).json({ error: "ไม่สามารถถอดบทบาท admin คนสุดท้ายของระบบได้" });
        }
        patch.role = role;
    }
    if (body.password !== undefined) {
        const password = String(body.password);
        if (password && password.length < 4) {
            return res.status(400).json({ error: "รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร" });
        }
        patch.password = password;
    }

    const user = await db.updateUser(id, patch);
    const changed = Object.keys(patch).map((k) => k).join(", ");
    await db.logActivity({ userId: req.user.id, username: req.user.username, action: "แก้ไขผู้ใช้", detail: `${target.username} (${changed})`, ip: req.ip });
    return res.json({ user });
}));

// DELETE /api/users/:id — ลบผู้ใช้
router.delete("/:id", adminOnly, asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "id ไม่ถูกต้อง" });
    }
    if (id === req.user.id) {
        return res.status(400).json({ error: "ไม่สามารถลบบัญชีของตัวเองได้" });
    }
    const target = await db.findUserById(id);
    if (!target) {
        return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    }
    if (target.role === "admin" && (await db.countAdmins()) <= 1) {
        return res.status(400).json({ error: "ไม่สามารถลบ admin คนสุดท้ายของระบบได้" });
    }
    await db.deleteUser(id);
    console.log(`🗑️ ${req.user.username} ลบผู้ใช้: ${target.username}`);
    await db.logActivity({ userId: req.user.id, username: req.user.username, action: "ลบผู้ใช้", detail: target.username, ip: req.ip });
    return res.json({ ok: true });
}));

// POST /api/users/:id/reset-2fa — ล้าง 2FA เดิม → login ครั้งหน้าต้องตั้งค่าใหม่ (ไม่ใช่ทางลัดข้าม 2FA)
router.post("/:id/reset-2fa", adminOnly, asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: "id ไม่ถูกต้อง" });
    }
    const target = await db.findUserById(id);
    if (!target) {
        return res.status(404).json({ error: "ไม่พบผู้ใช้" });
    }
    await db.resetTwoFa(id);
    console.log(`🔐 ${req.user.username} รีเซ็ต 2FA ของผู้ใช้: ${target.username}`);
    await db.logActivity({ userId: req.user.id, username: req.user.username, action: "รีเซ็ต 2FA", detail: target.username, ip: req.ip });
    return res.json({ ok: true });
}));

module.exports = router;

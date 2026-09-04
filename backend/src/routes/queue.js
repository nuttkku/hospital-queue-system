// 📋 Routes: จัดการคิว (มี RBAC กำกับ)
const express = require("express");
const db = require("../db");
const { requireAuth, allowRoles } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

function sanitizeName(name) {
    return String(name || "").replace(/[\r\n\t]+/g, " ").trim().slice(0, 200);
}

// GET /api/queue — ดูคิว (ทุกบทบาทที่ login แล้ว)
router.get("/", requireAuth, asyncHandler(async (req, res) => {
    return res.json(await db.getQueue());
}));

// POST /api/queue — เพิ่มคิว (admin, receptionist)
router.post("/", requireAuth, allowRoles("admin", "receptionist"), asyncHandler(async (req, res) => {
    const clean = sanitizeName(req.body && req.body.name);
    if (!clean) {
        return res.status(400).json({ error: "ชื่อผู้ป่วยว่างเปล่า" });
    }
    await db.addPatient(clean);
    console.log(`➕ ${req.user.username} เพิ่มคิว (รอตรวจ): ${clean}`);
    await db.logActivity({ userId: req.user.id, username: req.user.username, action: "เพิ่มคิว", detail: clean, ip: req.ip });
    return res.json({ ok: true, ...(await db.getQueue()) });
}));

// POST /api/queue/move — เลื่อนสถานะ waiting -> checking -> done (admin, doctor)
router.post("/move", requireAuth, allowRoles("admin", "doctor"), asyncHandler(async (req, res) => {
    const { from, index } = (req.body && req.body) || {};
    const moved = await db.movePatient(from, index);
    console.log(`🚶 ${req.user.username} ย้าย ${moved} (${from} -> ${db.nextStatus(from)})`);
    await db.logActivity({ userId: req.user.id, username: req.user.username, action: `เลื่อนสถานะ ${from} -> ${db.nextStatus(from)}`, detail: moved, ip: req.ip });
    return res.json({ ok: true, ...(await db.getQueue()) });
}));

// POST /api/queue/clear — ล้างคิวที่รอตรวจ (admin, receptionist)
router.post("/clear", requireAuth, allowRoles("admin", "receptionist"), asyncHandler(async (req, res) => {
    await db.clearWaiting();
    console.log(`🗑️ ${req.user.username} ล้างคิวที่รอตรวจแล้ว`);
    await db.logActivity({ userId: req.user.id, username: req.user.username, action: "ล้างคิวที่รอตรวจ", detail: "ลบผู้ป่วยในสถานะรอตรวจทั้งหมด", ip: req.ip });
    return res.json({ ok: true, ...(await db.getQueue()) });
}));

// POST /api/queue/clear-all — ล้างข้อมูลทุกสถานะ (admin เท่านั้น)
router.post("/clear-all", requireAuth, allowRoles("admin"), asyncHandler(async (req, res) => {
    await db.clearAll();
    console.log(`🧹 ${req.user.username} ล้างข้อมูลทุกสถานะแล้ว`);
    await db.logActivity({ userId: req.user.id, username: req.user.username, action: "ล้างข้อมูลทั้งหมด", detail: "ลบผู้ป่วยทุกสถานะ (รอตรวจ/กำลังตรวจ/ตรวจเสร็จ)", ip: req.ip });
    return res.json({ ok: true, ...(await db.getQueue()) });
}));

module.exports = router;

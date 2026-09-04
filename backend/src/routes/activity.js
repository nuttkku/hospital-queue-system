// 📜 Routes: Activity Log + บันทึกการเข้าหน้า/เมนู
const express = require("express");
const db = require("../db");
const { requireAuth, allowRoles } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();
const adminOnly = [requireAuth, allowRoles("admin")];

// GET /api/activity-log — รายการ Activity Log (admin, หน้าละ 10 รายการ)
router.get("/activity-log", adminOnly, asyncHandler(async (req, res) => {
    const data = await db.listActivityLogs({
        page: req.query.page || 1,
        perPage: req.query.perPage || 10,
    });
    return res.json(data);
}));

// POST /api/audit/page — บันทึกว่าผู้ใช้เปิดหน้า/กดเมนูไหน (เรียกจากฝั่ง frontend)
router.post("/audit/page", requireAuth, asyncHandler(async (req, res) => {
    const body = req.body || {};
    const page = String(body.page || body.route || "").trim().slice(0, 200);
    const label = String(body.label || page || "หน้า").trim().slice(0, 100);
    if (!page) {
        return res.status(400).json({ error: "ไม่พบชื่อหน้า" });
    }
    await db.logActivity({
        userId: req.user.id,
        username: req.user.username,
        action: `กดเมนู/เข้าหน้า: ${label}`,
        detail: page,
        ip: req.ip,
    });
    return res.json({ ok: true });
}));

module.exports = router;

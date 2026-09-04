// ⚙️ Routes: Settings (admin) — ตั้งค่า Social Login
const express = require("express");
const { requireAuth, allowRoles } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const social = require("../services/social.service");

const router = express.Router();
const adminOnly = [requireAuth, allowRoles("admin")];

// GET /api/settings/social — อ่าน config ของทุก provider (secret ถูกซ่อน)
router.get("/social", adminOnly, asyncHandler(async (req, res) => {
    const providers = [];
    for (const id of Object.keys(social.PROVIDERS)) {
        providers.push(await social.getAdminView(id));
    }
    return res.json({ providers });
}));

// PUT /api/settings/social — บันทึก config ของ provider หนึ่ง
router.put("/social", adminOnly, asyncHandler(async (req, res) => {
    const { provider, enabled, clientId, secret } = req.body || {};
    if (!social.PROVIDERS[provider]) {
        return res.status(400).json({ error: "ไม่รู้จัก provider (ใช้ facebook / google / line)" });
    }
    await social.saveConfig(provider, { enabled, clientId, secret });
    const view = await social.getAdminView(provider);
    console.log(`⚙️ ${req.user.username} อัปเดต Social Login: ${provider} enabled=${view.enabled} configured=${view.configured}`);
    return res.json({ provider: view });
}));

module.exports = router;

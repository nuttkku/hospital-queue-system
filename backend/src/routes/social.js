// 🌐 Routes: Social Login (Facebook / Google / LINE) — mounted ที่ /api/auth
//   GET /social/providers        : รายชื่อ provider ที่พร้อมใช้ (สำหรับหน้า Login)
//   GET /social/:provider/start  : redirect ไปหน้า login ของ provider นั้น
//   GET /social/callback/:provider : provider redirect กลับมา → สร้าง user/ผูก + เข้า flow 2FA
const crypto = require("crypto");
const express = require("express");
const db = require("../db");
const social = require("../services/social.service");
const { signPreAuthToken, preAuthCookieOptions, clearCookieOptions } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://localhost";

// GET /api/auth/social/providers — คืนทั้ง 3 provider + สถานะ configured (ให้หน้า Login แสดงปุ่มเสมอ)
router.get("/social/providers", asyncHandler(async (req, res) => {
    const providers = [];
    for (const id of Object.keys(social.PROVIDERS)) {
        const view = await social.getAdminView(id);
        providers.push({ id, label: view.label, configured: view.configured });
    }
    return res.json({ providers });
}));

// GET /api/auth/social/:provider/start
router.get("/social/:provider/start", asyncHandler(async (req, res) => {
    const { provider } = req.params;
    if (!social.PROVIDERS[provider]) {
        return res.status(400).json({ error: "ไม่รู้จัก provider" });
    }
    const cfg = await social.getConfig(provider);
    if (!social.isConfigured(cfg)) {
        return res.status(400).json({
            error: `ยังไม่ได้ตั้งค่า ${social.PROVIDERS[provider].label} — ให้ admin ไปตั้งค่าที่หน้า Settings`,
        });
    }

    const state = crypto.randomBytes(16).toString("hex");
    social.setStateCookie(res, provider, state);
    const authUrl = social.buildAuthUrl(provider, cfg, state);
    return res.redirect(authUrl);
}));

// GET /api/auth/social/callback/:provider
router.get("/social/callback/:provider", asyncHandler(async (req, res) => {
    const { provider } = req.params;
    const { code, state, error: providerError } = req.query;

    const redirect = (path) => res.redirect(`${PUBLIC_BASE_URL}${path}`);

    if (!social.PROVIDERS[provider]) return redirect("/login?social_error=unknown_provider");
    if (providerError) return redirect(`/login?social_error=${encodeURIComponent(providerError)}`);
    if (!code || !state) return redirect("/login?social_error=missing_params");
    if (!social.verifyStateCookie(req, provider, state)) {
        return redirect("/login?social_error=invalid_state");
    }

    try {
        const cfg = await social.getConfig(provider);
        if (!social.isConfigured(cfg)) {
            return redirect("/login?social_error=not_configured");
        }

        const profile = await social.exchangeCode(provider, cfg, code);
        let user = await db.findUserBySocial(provider, profile.providerUserId);
        if (!user) {
            // ยังไม่เคยเชื่อม — สร้างบัญชีอัตโนมัติ (บทบาทเริ่มต้น receptionist)
            user = await db.createSocialUser({
                provider,
                providerUserId: profile.providerUserId,
                name: profile.name,
            });
            console.log(`🌐 สร้างผู้ใช้จาก ${provider}: ${user.username}`);
        }

        social.clearStateCookie(res);
        // เข้า flow 2FA เหมือน login ปกติ (ทุกบัญชีต้องผ่าน 2FA)
        const stage = user.totpEnabled ? "verify" : "setup";
        res.clearCookie("token", clearCookieOptions());
        res.cookie("pre_auth", signPreAuthToken(user.id, stage), preAuthCookieOptions());

        return stage === "setup"
            ? redirect("/2fa/setup")
            : redirect("/2fa/verify");
    } catch (err) {
        console.error("❌ Social login failed:", err.message);
        return redirect(`/login?social_error=${encodeURIComponent(err.message)}`);
    }
}));

module.exports = router;

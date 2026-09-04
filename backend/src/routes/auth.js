// 🔑 Routes: login / 2FA (TOTP) / logout / me
// Flow (อ้างอิง nuttkku/2FA-example-coding):
//   1. login ตรวจรหัสผ่าน → ออก pre-auth cookie + stage (setup_required / verify_required)
//   2. ยังไม่เคยตั้ง 2FA → POST /2fa/setup -> /2fa/setup/confirm  (ได้ backup codes)
//      เคยตั้งแล้ว      → POST /2fa/verify  (code จากแอป หรือ backup code)
//   3. ผ่าน 2FA → ออก session cookie (token) แล้วเข้าใช้งานได้
const express = require("express");
const bcrypt = require("bcryptjs");
const db = require("../db");
const twofa = require("../services/twofa.service");
const {
    signToken,
    signPreAuthToken,
    cookieOptions,
    preAuthCookieOptions,
    clearCookieOptions,
    requireAuth,
    requirePreAuth,
} = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

function setPreAuthCookie(res, userId, stage) {
    res.cookie("pre_auth", signPreAuthToken(userId, stage), preAuthCookieOptions());
}

function setSessionCookie(res, user) {
    res.cookie("token", signToken(user), cookieOptions());
}

function clearAuthCookies(res) {
    res.clearCookie("token", clearCookieOptions());
    res.clearCookie("pre_auth", clearCookieOptions());
}

// POST /api/auth/login — ขั้นตอนที่ 1: ตรวจรหัสผ่าน
router.post("/login", asyncHandler(async (req, res) => {
    const username = String((req.body && req.body.username) || "").trim();
    const password = String((req.body && req.body.password) || "");
    if (!username || !password) {
        return res.status(400).json({ error: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน" });
    }

    const user = await db.findUserWithPassword(username);
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({ error: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" });
    }

    // ทุกบัญชีต้องผ่าน 2FA — ไม่มีทางลัดข้าม
    const stage = user.totp_enabled ? "verify" : "setup";
    clearAuthCookies(res); // เคลียร์ session/pre-auth เก่า (ถ้ามี)
    setPreAuthCookie(res, user.id, stage);
    await db.logActivity({ userId: user.id, username: user.username, action: "เข้าสู่ระบบ (ผ่านรหัสผ่าน)", detail: `รอขั้นตอน 2FA: ${stage}`, ip: req.ip });

    if (stage === "setup") {
        return res.json({ stage: "setup_required", user: db.toSafeUser(user) });
    }
    return res.json({ stage: "verify_required", user: db.toSafeUser(user) });
}));

// POST /api/auth/2fa/setup — สร้าง secret + QR (สำหรับคนที่ยังไม่เคยตั้ง 2FA)
router.post("/2fa/setup", requirePreAuth("setup"), asyncHandler(async (req, res) => {
    const user = await db.getAuthUser(req.preAuthUserId);
    const data = await twofa.startSetup(user.id, user.username);
    return res.json(data);
}));

// POST /api/auth/2fa/setup/confirm — ยืนยัน code แรก → เปิดใช้งาน 2FA + ออก backup codes
router.post("/2fa/setup/confirm", requirePreAuth("setup"), asyncHandler(async (req, res) => {
    const code = String((req.body && req.body.code) || "").trim();
    if (!code) {
        return res.status(400).json({ error: "กรุณากรอกรหัสยืนยัน 6 หลัก" });
    }
    const backupCodes = await twofa.confirmSetup(req.preAuthUserId, code);
    const user = await db.getAuthUser(req.preAuthUserId);
    setSessionCookie(res, user);
    // ผ่าน 2FA แล้ว -> ลบเฉพาะ pre-auth token (เก็บ session token ไว้)
    res.clearCookie("pre_auth", clearCookieOptions());
    return res.json({ user: db.toSafeUser(user), backupCodes });
}));

// POST /api/auth/2fa/verify — ขั้นตอนที่ 2: ตรวจ code ตอน login (ทุกครั้ง)
router.post("/2fa/verify", requirePreAuth("verify"), asyncHandler(async (req, res) => {
    const code = String((req.body && req.body.code) || "").trim();
    if (!code) {
        return res.status(400).json({ error: "กรุณากรอกรหัสยืนยัน (6 หลัก หรือ backup code)" });
    }
    await twofa.verifyLogin(req.preAuthUserId, code);
    const user = await db.getAuthUser(req.preAuthUserId);
    setSessionCookie(res, user);
    // ผ่าน 2FA แล้ว -> ลบเฉพาะ pre-auth token (เก็บ session token ไว้)
    res.clearCookie("pre_auth", clearCookieOptions());
    return res.json({ user: db.toSafeUser(user) });
}));

// POST /api/auth/2fa/backup-codes — สร้าง backup codes ชุดใหม่ (สำหรับคนที่ login แล้ว)
router.post("/2fa/backup-codes", requireAuth, asyncHandler(async (req, res) => {
    const backupCodes = await twofa.issueBackupCodes(req.user.id);
    return res.json({ backupCodes });
}));

// GET /api/auth/me — ตรวจ session ว่ายังใช้ได้หรือไม่
router.get("/me", requireAuth, asyncHandler(async (req, res) => {
    return res.json({ user: req.user });
}));

// POST /api/auth/logout
router.post("/logout", (req, res) => {
    clearAuthCookies(res);
    return res.json({ ok: true });
});

module.exports = router;

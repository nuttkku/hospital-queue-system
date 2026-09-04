// 🔐 Middleware JWT + RBAC + 2FA (pre-auth / session token)
// อ้างอิงแนวคิด nuttkku/2FA-example-coding: หลังตรวจรหัสผ่านจะออก "pre-auth token"
// ที่ใช้ได้เฉพาะขั้นตอน 2FA เท่านั้น (ไม่สามารถเรียก API อื่นได้) เสร็จ 2FA แล้วค่อยออก session token
const jwt = require("jsonwebtoken");
const db = require("../db");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me-in-production";
const SESSION_TTL_HOURS = 12;
const PREAUTH_TTL_MINUTES = 10;

function baseCookieOptions(maxAgeMs) {
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE === "true",
        path: "/",
        ...(maxAgeMs ? { maxAge: maxAgeMs } : {}),
    };
}

function signToken(user) {
    return jwt.sign(
        { sub: user.id, role: user.role, typ: "session" },
        JWT_SECRET,
        { expiresIn: `${SESSION_TTL_HOURS}h` }
    );
}

function signPreAuthToken(userId, stage) {
    return jwt.sign(
        { sub: userId, stage, typ: "pre_auth" },
        JWT_SECRET,
        { expiresIn: `${PREAUTH_TTL_MINUTES}m` }
    );
}

function cookieOptions() {
    return baseCookieOptions(SESSION_TTL_HOURS * 60 * 60 * 1000);
}

function preAuthCookieOptions() {
    return baseCookieOptions(PREAUTH_TTL_MINUTES * 60 * 1000);
}

function clearCookieOptions() {
    return baseCookieOptions();
}

// ต้อง login จริง ๆ (session token หลังผ่าน 2FA แล้วเท่านั้น)
async function requireAuth(req, res, next) {
    const token = req.cookies && req.cookies.token;
    if (!token) {
        return res.status(401).json({ error: "กรุณาเข้าสู่ระบบก่อน" });
    }
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        if (payload.typ !== "session") {
            return res.status(401).json({ error: "เซสชันไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่" });
        }
        const user = await db.findUserById(payload.sub);
        if (!user) {
            return res.status(401).json({ error: "ไม่พบผู้ใช้ในระบบ" });
        }
        req.user = user;
        return next();
    } catch {
        return res.status(401).json({ error: "เซสชันหมดอายุหรือไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่" });
    }
}

// ยังไม่ผ่าน 2FA — อนุญาตเฉพาะ endpoint ในขั้นตอน 2FA ตาม stage ที่ออก pre-auth token ไว้
function requirePreAuth(stage) {
    return (req, res, next) => {
        const token = req.cookies && req.cookies.pre_auth;
        if (!token) {
            return res.status(401).json({ error: "2FA session หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
        }
        try {
            const payload = jwt.verify(token, JWT_SECRET);
            if (payload.typ !== "pre_auth" || payload.stage !== stage) {
                return res.status(401).json({ error: "2FA session หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
            }
            req.preAuthUserId = payload.sub;
            return next();
        } catch {
            return res.status(401).json({ error: "2FA session หมดอายุ กรุณาเข้าสู่ระบบใหม่" });
        }
    };
}

// เช็คสิทธิ์ตามบทบาท (ต้องวางต่อจาก requireAuth)
function allowRoles(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: "กรุณาเข้าสู่ระบบก่อน" });
        }
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: "ไม่มีสิทธิ์ดำเนินการนี้ (เฉพาะ " + roles.join(", ") + ")" });
        }
        return next();
    };
}

module.exports = {
    signToken,
    signPreAuthToken,
    cookieOptions,
    preAuthCookieOptions,
    clearCookieOptions,
    requireAuth,
    requirePreAuth,
    allowRoles,
};


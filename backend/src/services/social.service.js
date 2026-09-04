// 🌐 Social Login service — จัดการ config + OAuth2 (Facebook / Google / LINE)
// เก็บ config ในตาราง app_settings (secret เข้ารหัส AES-256-GCM เหมือน TOTP secret)
// callback ทั้งหมด: {PUBLIC_BASE_URL}/api/auth/social/callback/{provider}
const jwt = require("jsonwebtoken");
const db = require("../db");
const { encryptSecret, decryptSecret } = require("../utils/crypto");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me-in-production";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://localhost";
const STATE_TTL_MINUTES = 10;

const PROVIDERS = {
    facebook: { id: "facebook", label: "Facebook" },
    google: { id: "google", label: "Google" },
    line: { id: "line", label: "LINE" },
};

function settingKey(provider) {
    return `social:${provider}`;
}

function defaultConfig() {
    return { enabled: false, clientId: "", secret: "" };
}

// ---------- อ่าน/เขียน config ----------
async function getConfig(provider) {
    const raw = await db.getSetting(settingKey(provider));
    let data = { ...defaultConfig() };
    if (raw) {
        try { data = { ...data, ...JSON.parse(raw) }; } catch { /* ใช้ค่า default */ }
    }
    if (data.secret) {
        try { data.secret = decryptSecret(data.secret); } catch { data.secret = ""; }
    }
    return data;
}

async function saveConfig(provider, { enabled, clientId, secret }) {
    const current = await getConfig(provider);
    const next = {
        enabled: Boolean(enabled),
        clientId: String(clientId || "").trim(),
        secret: current.secret, // ถ้าไม่ส่ง secret มา = คงค่าเดิม
    };
    const newSecret = String(secret || "").trim();
    if (newSecret) next.secret = encryptSecret(newSecret);

    await db.setSetting(settingKey(provider), JSON.stringify(next));
}

function isConfigured(cfg) {
    return Boolean(cfg.enabled && cfg.clientId && cfg.secret);
}

// มุมมองสำหรับหน้า Setting (ต้องไม่คืน secret จริงกลับไป)
async function getAdminView(provider) {
    const cfg = await getConfig(provider);
    return {
        id: provider,
        label: PROVIDERS[provider].label,
        enabled: Boolean(cfg.enabled),
        clientId: cfg.clientId || "",
        hasSecret: Boolean(cfg.secret),
        configured: isConfigured(cfg),
        callbackUrl: callbackUrl(provider),
    };
}

// รายชื่อ provider ที่เปิดใช้งาน (สำหรับหน้า Login)
async function listEnabledProviders() {
    const out = [];
    for (const id of Object.keys(PROVIDERS)) {
        const cfg = await getConfig(id);
        if (isConfigured(cfg)) {
            out.push({ id, label: PROVIDERS[id].label });
        }
    }
    return out;
}

function callbackUrl(provider) {
    return `${PUBLIC_BASE_URL}/api/auth/social/callback/${provider}`;
}

// ---------- state cookie (กัน CSRF ตอน callback) ----------
function cookieOptions(maxAge) {
    return {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.COOKIE_SECURE === "true",
        path: "/",
        ...(maxAge ? { maxAge } : {}),
    };
}

function setStateCookie(res, provider, state) {
    const token = jwt.sign(
        { typ: "social_state", provider, state },
        JWT_SECRET,
        { expiresIn: `${STATE_TTL_MINUTES}m` }
    );
    res.cookie("social_state", token, cookieOptions(STATE_TTL_MINUTES * 60 * 1000));
}

function verifyStateCookie(req, provider, state) {
    const token = req.cookies && req.cookies.social_state;
    if (!token) return false;
    try {
        const payload = jwt.verify(token, JWT_SECRET);
        return payload.typ === "social_state" && payload.provider === provider && payload.state === state;
    } catch {
        return false;
    }
}

function clearStateCookie(res) {
    res.clearCookie("social_state", cookieOptions());
}

// ---------- สร้าง URL สำหรับให้ browser ไปหน้า login ของแต่ละ provider ----------
function buildAuthUrl(provider, cfg, state) {
    const redirectUri = callbackUrl(provider);
    if (provider === "google") {
        const qs = new URLSearchParams({
            client_id: cfg.clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: "openid email profile",
            state,
            access_type: "online",
            prompt: "select_account",
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${qs.toString()}`;
    }
    if (provider === "facebook") {
        const qs = new URLSearchParams({
            client_id: cfg.clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: "email,public_profile",
            state,
        });
        return `https://www.facebook.com/v19.0/dialog/oauth?${qs.toString()}`;
    }
    if (provider === "line") {
        const qs = new URLSearchParams({
            response_type: "code",
            client_id: cfg.clientId,
            redirect_uri: redirectUri,
            state,
            scope: "openid profile",
        });
        return `https://access.line.me/oauth2/v2.1/authorize?${qs.toString()}`;
    }
    return null;
}

// ---------- แลก code -> token -> profile ของผู้ใช้ ----------
async function postForm(url, body) {
    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(body).toString(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${data.error || "request failed"} (${res.status})`);
    return data;
}

async function exchangeCode(provider, cfg, code) {
    const redirectUri = callbackUrl(provider);

    if (provider === "google") {
        const token = await postForm("https://oauth2.googleapis.com/token", {
            client_id: cfg.clientId,
            client_secret: cfg.secret,
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
        });
        const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
            headers: { Authorization: `Bearer ${token.access_token}` },
        });
        const profile = await res.json().catch(() => ({}));
        if (!res.ok || !profile.sub) throw new Error("ไม่สามารถดึงข้อมูลผู้ใช้จาก Google ได้");
        return {
            providerUserId: String(profile.sub),
            name: profile.name || profile.email || "Google user",
            email: profile.email || null,
        };
    }

    if (provider === "facebook") {
        const tokenRes = await fetch(
            `https://graph.facebook.com/v19.0/oauth/access_token?${new URLSearchParams({
                client_id: cfg.clientId,
                client_secret: cfg.secret,
                code,
                redirect_uri: redirectUri,
            }).toString()}`
        );
        const token = await tokenRes.json().catch(() => ({}));
        if (!tokenRes.ok || !token.access_token) {
            throw new Error(`Facebook exchange token ล้มเหลว: ${token.error && token.error.message}`);
        }
        const res = await fetch(
            `https://graph.facebook.com/v19.0/me?${new URLSearchParams({
                fields: "id,name,email",
                access_token: token.access_token,
            }).toString()}`
        );
        const profile = await res.json().catch(() => ({}));
        if (!res.ok || !profile.id) throw new Error("ไม่สามารถดึงข้อมูลผู้ใช้จาก Facebook ได้");
        return {
            providerUserId: String(profile.id),
            name: profile.name || "Facebook user",
            email: profile.email || null,
        };
    }

    if (provider === "line") {
        const token = await postForm("https://api.line.me/oauth2/v2.1/token", {
            client_id: cfg.clientId,
            client_secret: cfg.secret,
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
        });
        const res = await fetch("https://api.line.me/v2/profile", {
            headers: { Authorization: `Bearer ${token.access_token}` },
        });
        const profile = await res.json().catch(() => ({}));
        if (!res.ok || !profile.userId) throw new Error("ไม่สามารถดึงข้อมูลผู้ใช้จาก LINE ได้");
        return {
            providerUserId: String(profile.userId),
            name: profile.displayName || "LINE user",
            email: null,
        };
    }

    throw new Error("ไม่รู้จัก provider");
}

module.exports = {
    PROVIDERS,
    getConfig,
    saveConfig,
    getAdminView,
    listEnabledProviders,
    callbackUrl,
    buildAuthUrl,
    exchangeCode,
    setStateCookie,
    verifyStateCookie,
    clearStateCookie,
};

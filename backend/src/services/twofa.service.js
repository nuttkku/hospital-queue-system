// 🔑 TOTP 2FA service — อ้างอิง nuttkku/2FA-example-coding (otplib + qrcode + backup codes)
const { authenticator } = require("otplib");
const QRCode = require("qrcode");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const db = require("../db");
const { encryptSecret, decryptSecret } = require("../utils/crypto");

// ยอมรับ code จาก ±1 ช่วงเวลา (30 วินาที) เพื่อกันปัญหา clock drift เล็กน้อย
authenticator.options = { window: 1 };

const TWOFA_ISSUER = process.env.TWOFA_ISSUER || "HospitalQueue";
const CODE_COUNT = 8;
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // ตัดอักษรที่อ่านสับสน (0/O, 1/I/L)

function generateTotpSecret() {
    return authenticator.generateSecret();
}

async function buildQrCode(secretBase32, accountName) {
    const otpauthUrl = authenticator.keyuri(accountName, TWOFA_ISSUER, secretBase32);
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrCodeDataUrl };
}

function verifyTotpCode(secretBase32, code) {
    return authenticator.check(String(code).trim(), secretBase32);
}

// ---------- Backup codes ----------
function randomBackupCode() {
    let code = "";
    for (let i = 0; i < 8; i += 1) {
        code += ALPHABET[crypto.randomInt(ALPHABET.length)];
        if (i === 3) code += "-";
    }
    return code;
}

function normalizeBackupCode(code) {
    return String(code).trim().toUpperCase().replace(/\s+/g, "");
}

function looksLikeBackupCode(code) {
    return /^[A-Z0-9]{4}-?[A-Z0-9]{4}$/i.test(normalizeBackupCode(code));
}

function generateBackupCodes() {
    const plainCodes = Array.from({ length: CODE_COUNT }, randomBackupCode);
    const hashedCodes = plainCodes.map((code) => bcrypt.hashSync(code, 10));
    return { plainCodes, hashedCodes };
}

// ---------- Flow: เริ่มตั้งค่า 2FA ----------
async function startSetup(userId, accountName) {
    const user = await db.getAuthUser(userId);
    if (user.totp_enabled) {
        const err = new Error("2FA เปิดใช้งานอยู่แล้วสำหรับบัญชีนี้");
        err.status = 409;
        throw err;
    }
    const secret = generateTotpSecret();
    await db.setTotpSecretPending(userId, encryptSecret(secret));
    const { otpauthUrl, qrCodeDataUrl } = await buildQrCode(secret, accountName);
    return { qrCodeDataUrl, secret, otpauthUrl };
}

// ---------- Flow: ยืนยันการตั้งค่า 2FA (ตรวจ code แรก) ----------
async function confirmSetup(userId, code) {
    const user = await db.getAuthUser(userId);
    if (!user.totp_secret_enc) {
        const err = new Error("ไม่พบการตั้งค่า 2FA ที่ค้างอยู่ กรุณาเริ่มตั้งค่าใหม่");
        err.status = 400;
        throw err;
    }
    const secret = decryptSecret(user.totp_secret_enc);
    if (!verifyTotpCode(secret, code)) {
        const err = new Error("รหัสยืนยันไม่ถูกต้อง");
        err.status = 400;
        throw err;
    }
    await db.enableTotp(userId);
    return issueBackupCodes(userId);
}

// ---------- Flow: ยืนยันตัวตนตอน login (code จากแอป หรือ backup code) ----------
async function verifyLogin(userId, code) {
    const user = await db.getAuthUser(userId);
    if (!user.totp_enabled || !user.totp_secret_enc) {
        const err = new Error("บัญชีนี้ยังไม่ได้ตั้งค่า 2FA");
        err.status = 400;
        throw err;
    }

    let valid = false;
    let usedBackupCode = false;

    if (looksLikeBackupCode(code)) {
        usedBackupCode = await consumeBackupCode(userId, normalizeBackupCode(code));
        valid = usedBackupCode;
    } else {
        const secret = decryptSecret(user.totp_secret_enc);
        valid = verifyTotpCode(secret, code);
    }

    if (!valid) {
        const err = new Error("รหัสยืนยันไม่ถูกต้อง (หรือ backup code ถูกใช้ไปแล้ว)");
        err.status = 400;
        throw err;
    }
    return { usedBackupCode };
}

// ---------- Backup codes: สร้างชุดใหม่ (โค้ดเก่าถูกลบทิ้งทั้งหมด) ----------
async function issueBackupCodes(userId) {
    const { plainCodes, hashedCodes } = generateBackupCodes();
    await db.clearBackupCodes(userId);
    await db.insertBackupCodes(userId, hashedCodes);
    return plainCodes;
}

async function consumeBackupCode(userId, normalizedCode) {
    const rows = await db.getUnusedBackupCodes(userId);
    for (const row of rows) {
        if (bcrypt.compareSync(normalizedCode, row.code_hash)) {
            await db.markBackupCodeUsed(row.id);
            return true;
        }
    }
    return false;
}

module.exports = {
    startSetup,
    confirmSetup,
    verifyLogin,
    issueBackupCodes,
    looksLikeBackupCode,
    normalizeBackupCode,
};

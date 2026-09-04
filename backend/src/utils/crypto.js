// 🔐 Utility เข้ารหัส/ถอดรหัส secret ของ TOTP (AES-256-GCM)
// อ้างอิงแนวคิดจาก repo nuttkku/2FA-example-coding — secret ไม่ควรเก็บเป็น plaintext ใน DB
const crypto = require("crypto");

const KEY_SOURCE = process.env.TOTP_ENCRYPTION_KEY || "dev-2fa-encryption-key-change-me";

// สร้าง key ขนาด 32 ไบต์จาก env string (ผ่าน sha256) — รองรับ key ยาวเท่าไรก็ได้
function getKey() {
    return crypto.createHash("sha256").update(KEY_SOURCE).digest();
}

// ใช้ AES-256-GCM แบบสุ่ม IV ทุกครั้ง → ciphertext ไม่ซ้ำกันแม้ secret เดียวกัน
function encryptSecret(plainText) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

function decryptSecret(payload) {
    const [ivHex, tagHex, dataHex] = String(payload).split(":");
    if (!ivHex || !tagHex || !dataHex) throw new Error("2FA secret อยู่ในรูปแบบที่ไม่ถูกต้อง");
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(dataHex, "hex")),
        decipher.final(),
    ]);
    return decrypted.toString("utf8");
}

module.exports = { encryptSecret, decryptSecret };

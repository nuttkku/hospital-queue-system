// 🤖 Routes: AI Chatbot สำหรับสอบถามวิธีการใช้งานระบบ
// เรียก DeepSeek API จากฝั่ง server (key อยู่ที่ env DEEPSEEK_API_KEY — ไม่หลุดไปหน้าเว็บ)
const express = require("express");
const { requireAuth } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");

const router = express.Router();

const API_KEY = process.env.DEEPSEEK_API_KEY || "";
const MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
const MAX_MESSAGE = 2000;

// บริบทของระบบให้ AI ใช้อธิบายวิธีใช้งาน (ถาม-ตอบเป็นภาษาไทย)
const SYSTEM_PROMPT = `คุณคือ "ผู้ช่วยใช้งานระบบคิวโรงพยาบาล" ที่ตอบคำถามเกี่ยวกับวิธีใช้ระบบนี้เท่านั้น
ตอบเป็นภาษาไทย กระชับ ตรงประเด็น ใช้อีโมจิเล็กน้อย และอธิบายทีละขั้นตอน

ข้อมูลระบบ (Hospital Queue System):
- หน้าเว็บ: เข้าใช้งานผ่านเบราว์เซอร์ที่ https://localhost แล้ว login ด้วยบัญชีผู้ใช้
- การ login: กรอกชื่อผู้ใช้ + รหัสผ่าน → ทุกบัญชีต้องยืนยัน 2FA (TOTP) ด้วย Google Authenticator ทุกครั้ง
  - ครั้งแรก: ระบบพาไปหน้า "ตั้งค่า 2FA" ให้สแกน QR code แล้วกรอกรหัส 6 หลัก → ได้ Backup codes (เก็บไว้ ใช้ครั้งเดียว)
  - ครั้งต่อมา: กรอกรหัส 6 หลักจากแอป หรือใช้ Backup code (รูปแบบ XXXX-XXXX)
  - ถ้าลืม/ทำเครื่องหาย: ให้ admin กดปุ่ม 🔐 "รีเซ็ต 2FA" ที่หน้า จัดการผู้ใช้ แล้วผู้ใช้นั้นจะต้องตั้งค่าใหม่ตอน login ครั้งหน้า
- มี 3 บทบาท (RBAC):
  1) admin (ผู้ดูแลระบบ): ทำได้ทุกอย่าง + จัดการผู้ใช้ (สร้าง/แก้ไข/ลบ/เปลี่ยนบทบาท/รีเซ็ตรหัสผ่าน/รีเซ็ต 2FA) + ล้างข้อมูลทั้งหมด
  2) receptionist (เจ้าหน้าที่รับคิว): เพิ่มคิวใหม่, ล้างคิวที่รอตรวจ — ไม่สามารถเลื่อนสถานะได้
  3) doctor (แพทย์): เริ่มตรวจ (เลื่อนจากรอตรวจ -> กำลังตรวจ) และตรวจเสร็จ (กำลังตรวจ -> ตรวจเสร็จ) — ไม่สามารถเพิ่มคิวได้
- การเพิ่มคิว: พิมพ์ชื่อผู้ป่วยในช่อง "กรุณากรอกชื่อผู้ป่วย..." แล้วกด "➕ เพิ่มคิว" หรือกด Enter (ผู้ป่วยจะเข้าสถานะ "รอตรวจ")
- กระดานคิว 3 คอลัมน์: 🕐 รอตรวจ | 🩺 กำลังตรวจ | ✅ ตรวจเสร็จ (ตัวเลขข้างหัวคอลัมน์ = จำนวน) อัปเดตอัตโนมัติทุก 5 วินาที
- การเลื่อนสถานะ: ดูได้เฉพาะ admin/doctor — กดปุ่ม "เริ่มตรวจ ▶" บนการ์ดคนไข้ในคอลัมน์รอตรวจ หรือ "✓ ตรวจเสร็จ" ในคอลัมน์กำลังตรวจ
- การล้างข้อมูล: admin/receptionist กด "🗑️ ล้างคิวที่รอตรวจ" (ลบเฉพาะคิวที่ยังรอ) / admin เท่านั้นกด "🧹 ล้างข้อมูลทั้งหมด" (มีหน้าต่อยืนยันก่อนลบ)
- การจัดการผู้ใช้ (admin เท่านั้น): เปิดเมนู "👥 จัดการผู้ใช้" — เพิ่มผู้ใช้ใหม่ (กรอกชื่อผู้ใช้/ชื่อ-นามสกุล/รหัสผ่าน/เลือกบทบาท), เปลี่ยนบทบาท/ชื่อ, รีเซ็ตรหัสผ่าน (🔑), รีเซ็ต 2FA (🔐), ลบผู้ใช้ (🗑️)
- เทคโนโลยี/โครงสร้าง: Frontend Vue 3 (nginx) → Reverse proxy (nginx HTTPS) → Backend Express.js → Database MariaDB
- ถ้าถูกถามเรื่องอื่นที่ไม่เกี่ยวกับระบบนี้ ให้ตอบสุภาพว่า "ขออภัยครับ ผมช่วยได้เฉพาะเรื่องการใช้งานระบบคิวโรงพยาบาลเท่านั้น"`;

function buildMessages(reqBody) {
    const history = Array.isArray(reqBody.history) ? reqBody.history.slice(-10) : [];
    const messages = [{ role: "system", content: SYSTEM_PROMPT }];

    for (const item of history) {
        const role = item.role === "user" || item.role === "assistant" ? item.role : null;
        if (!role) continue;
        const content = String(item.content || "").slice(0, MAX_MESSAGE);
        if (content) messages.push({ role, content });
    }

    const message = String((reqBody && reqBody.message) || "").trim().slice(0, MAX_MESSAGE);
    if (message) messages.push({ role: "user", content: message });
    return messages;
}

async function callDeepSeek(messages) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const res = await fetch(DEEPSEEK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${API_KEY}`,
            },
            body: JSON.stringify({
                model: MODEL,
                messages,
                temperature: 0.6,
                max_tokens: 600,
            }),
            signal: controller.signal,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => "");
            throw new Error(`DeepSeek API error (${res.status}): ${text.slice(0, 300)}`);
        }

        const data = await res.json();
        const reply = data && data.choices && data.choices[0] && data.choices[0].message
            ? data.choices[0].message.content
            : "";
        return reply || "ขออภัยครับ ไม่ได้รับคำตอบจาก AI ในตอนนี้ กรุณาลองถามใหม่อีกครั้ง";
    } finally {
        clearTimeout(timeout);
    }
}

// POST /api/chat — ถามคำถาม (ต้อง login แล้ว)
router.post("/", requireAuth, asyncHandler(async (req, res) => {
    const body = req.body || {};
    const message = String(body.message || "").trim();

    if (!API_KEY) {
        return res.status(503).json({ error: "ยังไม่ได้ตั้งค่า DEEPSEEK_API_KEY ในเซิร์ฟเวอร์" });
    }
    if (!message) {
        return res.status(400).json({ error: "กรุณาพิมพ์คำถามก่อนส่ง" });
    }

    const messages = buildMessages(body);
    const reply = await callDeepSeek(messages);
    console.log(`🤖 ${req.user.username}: "${message.slice(0, 80)}"`);
    return res.json({ reply });
}));

module.exports = router;

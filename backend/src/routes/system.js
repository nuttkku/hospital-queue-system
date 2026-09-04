// 🖥️ Routes: ดูทรัพยากรเครื่องเซิร์ฟเวอร์ (admin เท่านั้น)
const fs = require("fs");
const os = require("os");
const path = require("path");
const express = require("express");
const db = require("../db");
const { requireAuth, allowRoles } = require("../middleware/auth");
const asyncHandler = require("../utils/async-handler");
const { askDeepSeek } = require("../utils/ai");

const router = express.Router();
const adminOnly = [requireAuth, allowRoles("admin")];

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// อ่าน % CPU จากค่า time ของทุก core (2 ตัวอย่างห่างกัน 400ms)
async function cpuUsagePercent() {
    const sample = () => {
        const cpus = os.cpus();
        let idle = 0;
        let total = 0;
        for (const cpu of cpus) {
            for (const type of Object.keys(cpu.times)) {
                total += cpu.times[type];
            }
            idle += cpu.times.idle;
        }
        return { idle, total };
    };

    const a = sample();
    await sleep(400);
    const b = sample();
    const idle = b.idle - a.idle;
    const total = b.total - a.total;
    if (total <= 0) return 0;
    return Math.round(((total - idle) / total) * 1000) / 10;
}

function memInfo() {
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;
    return {
        total,
        free,
        used,
        percent: total ? Math.round((used / total) * 1000) / 10 : 0,
    };
}

function diskInfo() {
    try {
        const st = fs.statfsSync("/");
        const total = st.blocks * st.bsize;
        const free = st.bavail * st.bsize;
        const used = total - free;
        return {
            mount: "/",
            total,
            free,
            used,
            percent: total ? Math.round((used / total) * 1000) / 10 : 0,
        };
    } catch {
        return { mount: "/", total: 0, free: 0, used: 0, percent: 0 };
    }
}

function formatUptime(seconds) {
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${d} วัน ${h} ชม. ${m} นาที ${s} วินาที`;
}

// GET /api/system/stats — snapshot ทรัพยากร
router.get("/stats", adminOnly, asyncHandler(async (req, res) => {
    const [cpuPercent, mem, disk] = await Promise.all([cpuUsagePercent(), Promise.resolve(memInfo()), Promise.resolve(diskInfo())]);
    return res.json({
        hostname: os.hostname(),
        platform: `${os.type()} (${os.platform()} ${os.arch()})`,
        osRelease: os.release(),
        cpuModel: os.cpus()[0] ? os.cpus()[0].model.trim() : "",
        cpuCores: os.cpus().length,
        cpuPercent,
        mem,
        disk,
        uptime: os.uptime(),
        uptimeText: formatUptime(os.uptime()),
        processUptimeText: formatUptime(process.uptime()),
        loadavg: os.loadavg(),
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
    });
}));

async function readJson(name) {
    const raw = await db.getSetting(name);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
}

// รวบรวมโค้ด backend เพื่อส่งให้ AI ตรวจ (จำกัดขนาดกัน token เต็ม)
function buildCodeBundle() {
    const root = path.join(__dirname, ".."); // backend/
    const files = [];

    const walk = (dir) => {
        for (const name of fs.readdirSync(dir)) {
            const full = path.join(dir, name);
            if (["node_modules", ".git", "dist", "scripts"].includes(name)) continue;
            const st = fs.statSync(full);
            if (st.isDirectory()) {
                walk(full);
            } else if (/\.(js|json)$/.test(name)) {
                files.push(path.relative(root, full).split(path.sep).join("/"));
            }
        }
    };
    walk(root);
    files.sort();

    const parts = [];
    for (const rel of files) {
        try {
            const content = fs.readFileSync(path.join(root, rel), "utf8");
            parts.push(`\n===== ${rel} =====\n${content}`);
        } catch { /* ข้ามไฟล์ที่อ่านไม่ได้ */ }
    }
    return parts.join("\n").slice(0, 50000);
}

// GET /api/system/security — อ่านรายงานช่องโหว่ (Trivy + AI scan) ที่เก็บไว้
router.get("/security", adminOnly, asyncHandler(async (req, res) => {
    const [trivy, ai] = await Promise.all([
        readJson("security:trivy"),
        readJson("security:ai"),
    ]);
    return res.json({ trivy, ai });
}));

// POST /api/system/security/ai-scan — ให้ DeepSeek ตรวจโค้ดเอง (ใช้เวลา ~30-60 วินาที)
router.post("/security/ai-scan", adminOnly, asyncHandler(async (req, res) => {
    const bundle = buildCodeBundle();
    const { model, reply } = await askDeepSeek([
        {
            role: "system",
            content:
                "คุณเป็นผู้ตรวจสอบความปลอดภัยซอฟต์แวร์อาวุโส (Application Security Auditor) " +
                "วิเคราะห์โค้ดที่ให้อย่างละเอียด แล้วรายงานเป็นภาษาไทย กระชับ ตรงประเด็น " +
                "เรียงตามความรุนแรง โดยแต่ละรายการมีรูปแบบ: [ระดับ] ตำแหน่งไฟล์/จุด - ปัญหา - แนวทางแก้ไข",
        },
        {
            role: "user",
            content:
                "ตรวจสอบโค้ดของระบบคิวโรงพยาบาลนี้ (Express.js + MariaDB + JWT/2FA) " +
                "ให้เจอช่องโหว่จริงที่อ่านจากโค้ดได้ เช่น SQL Injection, XSS, auth bypass, 2FA/logic flaw, secret leak, " +
                "path traversal, insecure defaults พร้อมบอกบรรทัด/ฟังก์ชัน และวิธีแก้โดยเฉพาะ\n\n" +
                "===== CODE =====\n" + bundle,
        },
    ], { maxTokens: 2500, temperature: 0.2 });

    const record = { scannedAt: new Date().toISOString(), model, reply };
    await db.setSetting("security:ai", JSON.stringify(record));
    console.log(`🤖 ${req.user.username} เรียก AI security scan สำเร็จ`);
    await db.logActivity({ userId: req.user.id, username: req.user.username, action: "สแกนความปลอดภัยด้วย AI", detail: "DeepSeek security scan", ip: req.ip });
    return res.json(record);
}));

const NGINX_LOG = process.env.NGINX_ACCESS_LOG || "/app/logs/web-access.log";
const ACCESS_LINE_RE = /^(\S+)\s+\S+\s+\S+\s+\[([^\]]+)\]\s+"([^"]*)"\s+(\d{3})\s+(\S+)\s+"([^"]*)"\s+"([^"]*)"/;

function parseNginxLine(line) {
    const m = line.match(ACCESS_LINE_RE);
    if (!m) return null;
    const [method, path, protocol] = m[3].split(" ");
    return {
        ip: m[1],
        time: m[2],
        method: method || "",
        path: path || "",
        protocol: protocol || "",
        status: Number(m[4]),
        bytes: m[5] === "-" ? 0 : Number(m[5]) || 0,
        referer: m[6] === "-" ? "" : m[6],
        userAgent: m[7] === "-" ? "" : m[7],
    };
}

// GET /api/system/access-log — Access log ของ nginx (proxy) แบ่งหน้าละ 10 แถว
router.get("/access-log", adminOnly, asyncHandler(async (req, res) => {
    let lines = [];
    try {
        const content = fs.readFileSync(NGINX_LOG, "utf8");
        lines = content.split(/\r?\n/).filter(Boolean).slice(-3000);
    } catch {
        lines = []; // ยังไม่มีไฟล์ log (เช่นยังไม่มี request)
    }

    const parsed = [];
    for (const line of lines) {
        const row = parseNginxLine(line);
        if (row) parsed.push(row);
    }
    parsed.reverse(); // แสดงใหม่สุดก่อน

    const perPage = Math.min(100, Math.max(1, Number(req.query.perPage) || 10));
    const page = Math.max(1, Number(req.query.page) || 1);
    const start = (page - 1) * perPage;
    return res.json({
        rows: parsed.slice(start, start + perPage),
        total: parsed.length,
        page,
        perPage,
        totalPages: Math.max(1, Math.ceil(parsed.length / perPage)),
    });
}));

module.exports = router;

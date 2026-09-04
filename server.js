// 🌸 Hospital Queue System — Frontend container (Node.js)
// 🗄️ ข้อมูลถูกเก็บใน MariaDB (container db) — ไม่ใช้ไฟล์ .txt อีกต่อไป
// วิธีรัน (แนะนำ): docker compose up --build แล้วเปิด http://localhost:3000
const http = require("http");
const fs = require("fs");
const path = require("path");
const db = require("./db");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".txt": "text/plain; charset=utf-8",
};

// ตัดอักขระไม่พึงประสงค์ (ขึ้นบรรทัดใหม่ / tab) ออกจากชื่อ
function sanitizeName(name) {
    return String(name).replace(/[\r\n\t]+/g, " ").trim().slice(0, 200);
}

// ---------- helper ตอบกลับ HTTP ----------
function sendJSON(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
}

function sendText(res, status, message) {
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(message);
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk;
            if (body.length > 10_000) {
                reject(new Error("ข้อมูลใหญ่เกินไป"));
                req.destroy();
            }
        });
        req.on("end", () => resolve(body));
        req.on("error", reject);
    });
}

function parseJSON(body) {
    try { return JSON.parse(body || "{}"); } catch { return null; }
}

// ---------- routes ----------
const server = http.createServer(async (req, res) => {
    try {
        let pathname;
        try {
            pathname = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
        } catch {
            return sendText(res, 400, "URL ไม่ถูกต้อง");
        }

        // GET /api/queue — อ่านสถานะทั้งหมดจาก MariaDB
        if (req.method === "GET" && pathname === "/api/queue") {
            return sendJSON(res, 200, await db.getQueue());
        }

        // POST /api/queue — เพิ่มคิวใหม่ (เข้าสถานะ รอตรวจ)
        if (req.method === "POST" && pathname === "/api/queue") {
            const payload = parseJSON(await readBody(req));
            if (!payload) return sendText(res, 400, "ข้อมูล JSON ไม่ถูกต้อง");
            const clean = sanitizeName(payload.name);
            if (!clean) return sendText(res, 400, "ชื่อผู้ป่วยว่างเปล่า");
            await db.addPatient(clean);
            console.log(`➕ เพิ่มคิว (รอตรวจ): ${clean}`);
            return sendJSON(res, 200, { ok: true, ...(await db.getQueue()) });
        }

        // POST /api/queue/move — เลื่อนสถานะ: waiting -> checking -> done
        if (req.method === "POST" && pathname === "/api/queue/move") {
            const payload = parseJSON(await readBody(req));
            if (!payload) return sendText(res, 400, "ข้อมูล JSON ไม่ถูกต้อง");
            try {
                const moved = await db.movePatient(payload.from, payload.index);
                console.log(`🚶 ย้าย ${moved} (${payload.from} -> ${db.nextStatus(payload.from)})`);
                return sendJSON(res, 200, { ok: true, ...(await db.getQueue()) });
            } catch (err) {
                return sendText(res, 400, err.message);
            }
        }

        // POST /api/queue/clear — ล้างเฉพาะคิวที่รอตรวจ
        if (req.method === "POST" && pathname === "/api/queue/clear") {
            await db.clearWaiting();
            console.log("🗑️ ล้างคิวที่รอตรวจแล้ว");
            return sendJSON(res, 200, { ok: true, ...(await db.getQueue()) });
        }

        // POST /api/queue/clear-all — ล้างข้อมูลทุกสถานะ
        if (req.method === "POST" && pathname === "/api/queue/clear-all") {
            await db.clearAll();
            console.log("🧹 ล้างข้อมูลทุกสถานะแล้ว");
            return sendJSON(res, 200, { ok: true, ...(await db.getQueue()) });
        }

        // ---------- เสิร์ฟไฟล์ static ----------
        if (req.method !== "GET") {
            return sendText(res, 405, "Method Not Allowed");
        }
        if (pathname === "/") pathname = "/index.html";

        const filePath = path.join(ROOT, path.normalize(pathname));
        if (!filePath.startsWith(ROOT)) return sendText(res, 403, "Forbidden");

        fs.readFile(filePath, (err, data) => {
            if (err) return sendText(res, 404, "404 Not Found: " + pathname);
            const ext = path.extname(filePath).toLowerCase();
            res.writeHead(200, { "Content-Type": MIME_TYPES[ext] || "application/octet-stream" });
            res.end(data);
        });
    } catch (err) {
        if (!res.headersSent) return sendText(res, 500, "Server error: " + err.message);
        res.end();
    }
});

// ---------- บูตระบบ: รอเชื่อมต่อ MariaDB ก่อนเริ่มรับ request ----------
(async () => {
    try {
        await db.init();
        server.listen(PORT, () => {
            console.log("🌸 Hospital Queue System is running!");
            console.log(`   ➜  http://localhost:${PORT}`);
            console.log("   🗄️  ข้อมูลเก็บใน MariaDB (container: db)");
        });
    } catch (err) {
        console.error("❌ เริ่มระบบไม่สำเร็จ:", err.message);
        process.exit(1);
    }
})();

// ปิดการเชื่อมต่อ DB ให้เรียบร้อยเมื่อ container ถูกหยุด
function shutdown() {
    server.close(async () => {
        await db.close();
        process.exit(0);
    });
    setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

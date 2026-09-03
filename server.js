// 🌸 Hospital Queue System — เว็บเซิร์ฟเวอร์ + บันทึกคิวลงไฟล์ queue.txt
// วิธีรัน: node server.js   จากนั้นเปิด http://localhost:3000
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const QUEUE_FILE = path.join(ROOT, "queue.txt"); // 📄 ไฟล์เก็บข้อมูลคิว

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

// ---------- ฟังก์ชันจัดการไฟล์คิว (queue.txt) ----------
// อ่านทุกบรรทัดจากไฟล์ -> แต่ละบรรทัดคือชื่อผู้ป่วย 1 คน
function readQueue() {
    if (!fs.existsSync(QUEUE_FILE)) return [];
    return fs.readFileSync(QUEUE_FILE, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

// ตัดอักขระไม่พึงประสงค์ (ขึ้นบรรทัดใหม่ / tab) ออกจากชื่อ
function sanitizeName(name) {
    return String(name).replace(/[\r\n\t]+/g, " ").trim().slice(0, 200);
}

// เพิ่มคิวใหม่ต่อท้ายไฟล์ (ไฟล์จะถูกสร้างอัตโนมัติถ้ายังไม่มี)
function appendToQueue(name) {
    fs.appendFileSync(QUEUE_FILE, name + "\n", "utf8");
}

// ล้างคิวทั้งหมดในไฟล์
function clearQueueFile() {
    fs.writeFileSync(QUEUE_FILE, "", "utf8");
}

// ---------- helper สำหรับตอบกลับ HTTP ----------
function sendJSON(res, status, data) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(data));
}

function sendText(res, status, message) {
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(message);
}

const server = http.createServer((req, res) => {
    let pathname;
    try {
        pathname = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
    } catch {
        return sendText(res, 400, "URL ไม่ถูกต้อง");
    }

    // GET /api/queue — ดึงรายการคิวทั้งหมดจากไฟล์ queue.txt
    if (req.method === "GET" && pathname === "/api/queue") {
        return sendJSON(res, 200, readQueue());
    }

    // POST /api/queue — เพิ่มคิวใหม่ แล้วบันทึกลงไฟล์ queue.txt
    if (req.method === "POST" && pathname === "/api/queue") {
        let body = "";
        req.on("data", (chunk) => {
            body += chunk;
            if (body.length > 10_000) req.destroy(); // จำกัดขนาด request
        });
        req.on("end", () => {
            try {
                const { name } = JSON.parse(body || "{}");
                const clean = sanitizeName(name);
                if (!clean) return sendText(res, 400, "ชื่อผู้ป่วยว่างเปล่า");
                appendToQueue(clean);
                console.log(`➕ เพิ่มคิว: ${clean}`);
                return sendJSON(res, 200, { ok: true, queue: readQueue() });
            } catch {
                return sendText(res, 400, "ข้อมูล JSON ไม่ถูกต้อง");
            }
        });
        return;
    }

    // POST /api/queue/clear — ล้างคิวทั้งหมดในไฟล์
    if (req.method === "POST" && pathname === "/api/queue/clear") {
        try {
            clearQueueFile();
            console.log("🗑️ ล้างคิวทั้งหมดแล้ว");
            return sendJSON(res, 200, { ok: true, queue: [] });
        } catch (err) {
            return sendText(res, 500, "ล้างคิวไม่สำเร็จ: " + err.message);
        }
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
});

server.listen(PORT, () => {
    console.log("🌸 Hospital Queue System is running!");
    console.log(`   ➜  http://localhost:${PORT}`);
    console.log(`   📄 ข้อมูลคิวถูกบันทึกที่: ${QUEUE_FILE}`);
});

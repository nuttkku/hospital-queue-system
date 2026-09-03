// 🌸 Hospital Queue System — เว็บเซิร์ฟเวอร์ บันทึกคิว + สถานะการตรวจลงไฟล์ .txt
// 📄 1 สถานะ = 1 ไฟล์ เก็บชื่อคนละบรรทัด (เหมือนกับการบันทึกคิว)
// วิธีรัน: node server.js   แล้วเปิด http://localhost:3000
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

// ไฟล์ข้อมูลแยกตามสถานะการตรวจ
const FILES = {
    waiting: path.join(ROOT, "queue.txt"),      // 🕐 รอตรวจ  (คิวที่เพิ่มใหม่จะอยู่ที่นี่)
    checking: path.join(ROOT, "checking.txt"),  // 🩺 กำลังตรวจ
    done: path.join(ROOT, "done.txt"),          // ✅ ตรวจเสร็จ
};

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

// ---------- ฟังก์ชันจัดการไฟล์ข้อมูล ----------
function readLines(file) {
    if (!fs.existsSync(file)) return [];
    return fs.readFileSync(file, "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
}

function writeLines(file, lines) {
    fs.writeFileSync(file, lines.length > 0 ? lines.join("\n") + "\n" : "", "utf8");
}

function appendLine(file, text) {
    fs.appendFileSync(file, text + "\n", "utf8");
}

// ตัดอักขระไม่พึงประสงค์ (ขึ้นบรรทัดใหม่ / tab) ออกจากชื่อ
function sanitizeName(name) {
    return String(name).replace(/[\r\n\t]+/g, " ").trim().slice(0, 200);
}

// อ่านสถานะทั้งหมด (waiting / checking / done)
function getQueue() {
    return {
        waiting: readLines(FILES.waiting),
        checking: readLines(FILES.checking),
        done: readLines(FILES.done),
    };
}

// สถานะถัดไปในสายพาน: waiting -> checking -> done
function nextStatus(from) {
    if (from === "waiting") return "checking";
    if (from === "checking") return "done";
    return null;
}

// ย้ายคนไข้ตำแหน่ง index ออกจากไฟล์สถานะ `from` ไปต่อท้ายไฟล์สถานะถัดไป
function movePatient(from, index) {
    const to = nextStatus(from);
    if (!to) throw new Error("สถานะต้นทางไม่ถูกต้อง (ใช้ได้เฉพาะ waiting หรือ checking)");

    const lines = readLines(FILES[from]);
    const i = Number(index);
    if (!Number.isInteger(i) || i < 0 || i >= lines.length) {
        throw new Error("ไม่พบรายการคิวในตำแหน่งที่เลือก (อาจถูกย้ายไปก่อนแล้ว)");
    }

    const [name] = lines.splice(i, 1);
    writeLines(FILES[from], lines);
    appendLine(FILES[to], name);
    return name;
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

        // GET /api/queue — อ่านสถานะทั้งหมดจากไฟล์
        if (req.method === "GET" && pathname === "/api/queue") {
            return sendJSON(res, 200, getQueue());
        }

        // POST /api/queue — เพิ่มคิวใหม่ (เข้าสถานะ รอตรวจ -> queue.txt)
        if (req.method === "POST" && pathname === "/api/queue") {
            const payload = parseJSON(await readBody(req));
            if (!payload) return sendText(res, 400, "ข้อมูล JSON ไม่ถูกต้อง");
            const clean = sanitizeName(payload.name);
            if (!clean) return sendText(res, 400, "ชื่อผู้ป่วยว่างเปล่า");
            appendLine(FILES.waiting, clean);
            console.log(`➕ เพิ่มคิว (รอตรวจ): ${clean}`);
            return sendJSON(res, 200, { ok: true, ...getQueue() });
        }

        // POST /api/queue/move — เลื่อนสถานะ: waiting -> checking -> done
        if (req.method === "POST" && pathname === "/api/queue/move") {
            const payload = parseJSON(await readBody(req));
            if (!payload) return sendText(res, 400, "ข้อมูล JSON ไม่ถูกต้อง");
            try {
                const moved = movePatient(payload.from, payload.index);
                console.log(`🚶 ย้าย ${moved} (${payload.from} -> ${nextStatus(payload.from)})`);
                return sendJSON(res, 200, { ok: true, ...getQueue() });
            } catch (err) {
                return sendText(res, 400, err.message);
            }
        }

        // POST /api/queue/clear — ล้างเฉพาะคิวที่รอตรวจ (queue.txt)
        if (req.method === "POST" && pathname === "/api/queue/clear") {
            fs.writeFileSync(FILES.waiting, "", "utf8");
            console.log("🗑️ ล้างคิวที่รอตรวจแล้ว");
            return sendJSON(res, 200, { ok: true, ...getQueue() });
        }

        // POST /api/queue/clear-all — ล้างข้อมูลทุกสถานะ
        if (req.method === "POST" && pathname === "/api/queue/clear-all") {
            for (const file of Object.values(FILES)) {
                fs.writeFileSync(file, "", "utf8");
            }
            console.log("🧹 ล้างข้อมูลทุกสถานะแล้ว");
            return sendJSON(res, 200, { ok: true, ...getQueue() });
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

server.listen(PORT, () => {
    console.log("🌸 Hospital Queue System is running!");
    console.log(`   ➜  http://localhost:${PORT}`);
    console.log("   📄 ไฟล์ข้อมูล (1 สถานะ = 1 ไฟล์):");
    for (const [status, file] of Object.entries(FILES)) {
        console.log(`      - ${status}: ${file}`);
    }
});

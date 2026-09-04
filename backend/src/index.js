// 🚀 Backend: Express.js — REST API เท่านั้น (ไม่เสิร์ฟ Frontend)
// สถาปัตยกรรมแยก container: frontend (nginx) เสิร์ฟ Vue + proxy /api → backend นี้
const fs = require("fs");
const path = require("path");
const express = require("express");
const cookieParser = require("cookie-parser");
const db = require("./db");

const PORT = Number(process.env.PORT || 3000);
const DIST_DIR = path.join(__dirname, "..", "..", "frontend", "dist");
const INDEX_FILE = path.join(DIST_DIR, "index.html");

const app = express();
app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

// ---------- REST API ----------
app.get("/api/health", (req, res) => res.json({ ok: true, name: "hospital-queue-backend" }));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/auth", require("./routes/social"));
app.use("/api/queue", require("./routes/queue"));
app.use("/api/users", require("./routes/users"));
app.use("/api/chat", require("./routes/chat"));
app.use("/api/system", require("./routes/system"));
app.use("/api/settings", require("./routes/settings"));
app.use("/api", require("./routes/activity"));

// ---------- เสิร์ฟ static frontend (เฉพาะกรณีรันแบบไม่แยก container มี dist อยู่) ----------
// โหมดแยก container: งานนี้เป็นของ container frontend (nginx) — backend ตอบ API อย่างเดียว
if (fs.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));

    // SPA fallback: เส้นทางอื่นที่ไม่ใช่ /api ให้คืน index.html (รองรับ vue-router history mode)
    app.use((req, res, next) => {
        if (req.method !== "GET") {
            return res.status(405).json({ error: "Method Not Allowed" });
        }
        if (req.path.startsWith("/api/")) {
            return res.status(404).json({ error: "ไม่พบ endpoint นี้" });
        }
        return res.sendFile(INDEX_FILE, (err) => {
            if (err) next(err);
        });
    });
}

// error handler กลาง
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error("❌ Server error:", err.message);
    if (res.headersSent) return next(err);
    // เคารพ err.status / err.statusCode ที่ service ตั้งไว้ (เช่น 400 รหัส 2FA ไม่ถูก)
    const status = Number(err.statusCode || err.status) || 500;
    return res.status(status).json({ error: err.message || "Server error" });
});

// ---------- บูตระบบ ----------
(async () => {
    try {
        await db.init();
        app.listen(PORT, () => {
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
    setTimeout(() => process.exit(0), 5000).unref();
    db.close().finally(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

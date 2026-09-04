// 🛠️ สคริปต์นำรายงาน Trivy (JSON) เข้า DB เพื่อแสดงบนหน้า "ตรวจสอบระบบ"
// วิธีใช้ (บนเครื่อง dev ที่มีผลลัพธ์จาก trivy):
//   node backend/src/scripts/import-security-report.js <path-to-trivy-summary.json>
// หรือภายใน container:
//   docker cp trivy-summary.json hospital-queue-backend:/tmp/trivy.json
//   docker compose exec -T backend node src/scripts/import-security-report.js /tmp/trivy.json
const fs = require("fs");
const db = require("../db");

(async () => {
    const file = process.argv[2];
    if (!file) {
        console.error("Usage: node src/scripts/import-security-report.js <trivy-summary.json>");
        process.exit(1);
    }
    try {
        const raw = fs.readFileSync(file, "utf8");
        JSON.parse(raw); // ตรวจว่าเป็น JSON ที่ถูกต้อง
        await db.init();
        await db.setSetting("security:trivy", raw);
        console.log("✅ บันทึกรายงาน Trivy ลง DB แล้ว (security:trivy)");
        process.exit(0);
    } catch (err) {
        console.error("❌ import ล้มเหลว:", err.message);
        process.exit(1);
    }
})();

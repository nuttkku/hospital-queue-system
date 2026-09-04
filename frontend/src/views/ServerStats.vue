<template>
    <div class="app-shell">
        <TopBar />
        <main class="container">
            <h1 class="page-title">🖥️ ทรัพยากรเซิร์ฟเวอร์</h1>

            <p v-if="error" class="error">{{ error }}</p>

            <!-- ข้อมูลเครื่อง -->
            <div class="sys-chips" v-if="stats">
                <span class="sys-chip">🖥️ {{ stats.hostname }}</span>
                <span class="sys-chip">{{ stats.platform }}</span>
                <span class="sys-chip">⏱️ {{ stats.uptimeText }}</span>
                <span class="sys-chip">🐳 Node {{ stats.nodeVersion }}</span>
            </div>

            <!-- กราฟ CPU / RAM / Disk -->
            <div class="stat-grid" v-if="stats">
                <div class="stat-card">
                    <div class="stat-head">🧠 CPU <span class="stat-val">{{ stats.cpuPercent }}%</span></div>
                    <div class="bar"><div class="bar-fill cpu" :style="{ width: Math.min(stats.cpuPercent, 100) + '%' }"></div></div>
                    <div class="stat-sub">{{ stats.cpuModel }} ({{ stats.cpuCores }} cores)</div>
                </div>

                <div class="stat-card">
                    <div class="stat-head">💾 หน่วยความจำ (RAM) <span class="stat-val">{{ stats.mem.percent }}%</span></div>
                    <div class="bar"><div class="bar-fill ram" :style="{ width: Math.min(stats.mem.percent, 100) + '%' }"></div></div>
                    <div class="stat-sub">ใช้ {{ gb(stats.mem.used) }} / {{ gb(stats.mem.total) }} GB</div>
                </div>

                <div class="stat-card">
                    <div class="stat-head">💿 ดิสก์ <span class="stat-val">{{ stats.disk.percent }}%</span></div>
                    <div class="bar"><div class="bar-fill disk" :style="{ width: Math.min(stats.disk.percent, 100) + '%' }"></div></div>
                    <div class="stat-sub">ใช้ {{ gb(stats.disk.used) }} / {{ gb(stats.disk.total) }} GB ({{ stats.disk.mount }})</div>
                </div>
            </div>

            <!-- รายละเอียดอื่น ๆ -->
            <div class="sys-table-wrap" v-if="stats">
                <table class="sys-table">
                    <tbody>
                        <tr><td>ระบบปฏิบัติการ</td><td>{{ stats.osRelease }}</td></tr>
                        <tr><td>Load average (1/5/15 นาที)</td><td>{{ stats.loadavg.map((v) => v.toFixed(2)).join(" / ") }}</td></tr>
                        <tr><td>เวลาที่เครื่องเปิด (uptime)</td><td>{{ stats.uptimeText }}</td></tr>
                        <tr><td>เวลาที่ process รัน</td><td>{{ stats.processUptimeText }}</td></tr>
                        <tr><td>โหนด Node.js</td><td>{{ stats.nodeVersion }}</td></tr>
                        <tr><td>อัปเดตล่าสุด</td><td>{{ new Date(stats.timestamp).toLocaleTimeString("th-TH") }}</td></tr>
                    </tbody>
                </table>
            </div>

            <!-- รายงานความปลอดภัย -->
            <h2 class="page-title" style="font-size: 1.25rem; margin-top: 1.5rem;">🔒 รายงานช่องโหว่ / ความปลอดภัย</h2>
            <p v-if="secError" class="error">{{ secError }}</p>

            <!-- Trivy scan -->
            <div class="stat-card sec-card">
                <div class="stat-head">
                    🐳 Trivy Scan (Dependencies & Image)
                    <span class="stat-val">{{ secTrivy ? fmtTime(secTrivy.scannedAt) : "ยังไม่สแกน" }}</span>
                </div>

                <div v-if="secTrivy" class="sec-counts">
                    <template v-for="lvl in sevLevels" :key="lvl">
                        <span
                            v-if="secTrivy.counts && secTrivy.counts[lvl]"
                            class="sev"
                            :class="'sev-' + lvl"
                        >{{ lvl.toUpperCase() }}: {{ secTrivy.counts[lvl] }}</span>
                    </template>
                    <span class="stat-sub">(target: {{ secTrivy.target || "-" }})</span>
                </div>

                <ul v-if="secTrivy && secTrivy.items && secTrivy.items.length" class="vuln-list">
                    <li v-for="(it, i) in secTrivy.items" :key="i" class="vuln-item">
                        <span class="sev-badge" :class="'sev-' + String(it.severity || 'unknown').toLowerCase()">{{ it.severity }}</span>
                        <code>{{ it.id }}</code>
                        <b>{{ it.pkg }} {{ it.installed }}</b>
                        <span v-if="it.fixed" class="fix-tag">→ แก้เป็น {{ it.fixed }}</span>
                        <div class="stat-sub">{{ it.title }}</div>
                    </li>
                </ul>
                <p v-if="secTrivy && (!secTrivy.items || !secTrivy.items.length)" class="stat-sub">✅ ไม่พบช่องโหว่ที่สแกนพบ</p>
                <p v-if="!secTrivy" class="stat-sub">ยังไม่มีรายงาน Trivy — ดูคำสั่งสแกนด้านล่าง แล้วอัปผลผ่านสคริปต์ import</p>
            </div>

            <!-- AI (DeepSeek) scan -->
            <div class="stat-card sec-card">
                <div class="stat-head">
                    🤖 AI Security Scan (DeepSeek {{ secAi ? secAi.model : "" }})
                    <button class="ai-scan-btn" :disabled="aiBusy" @click="runAiScan">
                        {{ aiBusy ? "กำลังสแกน (~30-60 วิ)..." : "สแกนโค้ดอีกครั้ง" }}
                    </button>
                </div>
                <p v-if="secAi" class="stat-sub">สแกนเมื่อ {{ fmtTime(secAi.scannedAt) }}</p>
                <pre v-if="secAi && secAi.reply" class="ai-report">{{ secAi.reply }}</pre>
                <p v-if="!secAi" class="stat-sub">ยังไม่เคยสแกนด้วย AI — กดปุ่ม "สแกนโค้ดอีกครั้ง" เพื่อให้ DeepSeek ตรวจโค้ด</p>
            </div>

            <!-- คำสั่งสแกน Trivy (สำหรับ admin รันเองเพื่อ refresh) -->
            <div class="stat-card sec-card sec-cmd">
                <div class="stat-head">🛠️ วิธีสแกน Trivy ใหม่แล้วอัปผล</div>
                <code class="cmd-block">
                    docker run --rm -v ${PWD}:/scan aquasec/trivy:latest fs --format json /scan &gt; trivy-fs.json
                </code>
                <p class="stat-sub">จากนั้นรัน: node backend/src/scripts/import-security-report.js (ดู README / ฝั่ง dev)</p>
            </div>
        </main>
    </div>
</template>

<script setup>
import { onErrorCaptured, onMounted, onUnmounted, ref } from "vue";
import api from "../api";
import TopBar from "../components/TopBar.vue";

const stats = ref(null);
const error = ref("");
const secTrivy = ref(null);
const secAi = ref(null);
const secError = ref("");
const aiBusy = ref(false);
let timer = null;

// ระดับความรุนแรงที่แสดงเป็น badges (คีย์ใน backend เป็นตัวพิมพ์เล็ก)
const sevLevels = ["critical", "high", "medium", "low", "unknown"];

// ถ้าเกิด error ระหว่าง render ให้โชว์บนหน้าแทนที่จะเป็นจอว่าง
onErrorCaptured((err) => {
    error.value = "เกิดข้อผิดพลาดในการแสดงหน้านี้: " + (err && err.message ? err.message : String(err));
    return false; // หยุดการกระจาย error (แสดงในหน้านี้เท่านั้น)
});

function gb(bytes) {
    return bytes ? (bytes / 1024 / 1024 / 1024).toFixed(1) : "0.0";
}

function fmtTime(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

async function loadSecurity() {
    try {
        const res = await api.get("/system/security");
        secTrivy.value = res.trivy || null;
        secAi.value = res.ai || null;
        secError.value = "";
    } catch (err) {
        secError.value = err.message || "โหลดรายงานความปลอดภัยไม่สำเร็จ";
    }
}

async function runAiScan() {
    if (aiBusy.value) return;
    aiBusy.value = true;
    secError.value = "";
    try {
        await api.post("/system/security/ai-scan");
        await loadSecurity();
    } catch (err) {
        secError.value = "AI scan ล้มเหลว: " + (err.message || "กรุณาลองใหม่");
    } finally {
        aiBusy.value = false;
    }
}

async function load() {
    try {
        stats.value = await api.get("/system/stats");
        error.value = "";
    } catch (err) {
        error.value = err.message || "โหลดข้อมูลไม่สำเร็จ";
    }
}

onMounted(() => {
    load();
    loadSecurity();
    timer = setInterval(load, 3000); // refresh อัตโนมัติทุก 3 วินาที
});
onUnmounted(() => {
    if (timer) clearInterval(timer);
});
</script>

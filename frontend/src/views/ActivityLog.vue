<template>
    <div class="app-shell">
        <TopBar />
        <main class="container">
            <h1 class="page-title">📜 Activity Log &amp; Access Log</h1>
            <p class="subtitle">บันทึกการกระทำของผู้ใช้ + access log ของ web engine (nginx) — หน้าแสดง 10 แถว</p>

            <div class="log-tabs">
                <button :class="{ active: tab === 'activity' }" @click="switchTab('activity')">👤 กิจกรรมผู้ใช้</button>
                <button :class="{ active: tab === 'access' }" @click="switchTab('access')">🌐 Access Log (nginx)</button>
                <button class="refresh-btn" :disabled="busy" @click="loadCurrent">🔄 รีเฟรช</button>
            </div>

            <p v-if="error" class="error">{{ error }}</p>

            <!-- 👤 Activity Log -->
            <section v-if="tab === 'activity'">
                <div class="table-wrap">
                    <table class="user-table">
                        <thead>
                            <tr>
                                <th>เวลา</th><th>ผู้ใช้</th><th>การกระทำ</th><th>รายละเอียด</th><th>IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="row in activity.rows" :key="row.id">
                                <td class="mono">{{ fmtTime(row.created_at) }}</td>
                                <td>{{ row.username || "-" }}</td>
                                <td>{{ row.action }}</td>
                                <td class="detail-cell">{{ row.detail || "-" }}</td>
                                <td class="mono">{{ row.ip_address || "-" }}</td>
                            </tr>
                            <tr v-if="!activity.rows.length">
                                <td colspan="5" class="empty">— ยังไม่มีกิจกรรม —</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <PagerBar :total="activity.total" :page="activity.page" :totalPages="activity.totalPages" @go="p => loadActivity(p)" />
            </section>

            <!-- 🌐 Access Log -->
            <section v-else>
                <div class="table-wrap">
                    <table class="user-table">
                        <thead>
                            <tr>
                                <th>เวลา</th><th>IP</th><th>Method</th><th>Path</th>
                                <th>Status</th><th>Bytes</th><th>Referer</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(r, i) in access.rows" :key="i">
                                <td class="mono">{{ r.time }}</td>
                                <td class="mono">{{ r.ip }}</td>
                                <td>{{ r.method }}</td>
                                <td class="path-cell" :title="r.path">{{ r.path }}</td>
                                <td><span class="http-status" :class="statusClass(r.status)">{{ r.status }}</span></td>
                                <td class="mono">{{ r.bytes }}</td>
                                <td class="path-cell" :title="r.referer">{{ r.referer || "-" }}</td>
                            </tr>
                            <tr v-if="!access.rows.length">
                                <td colspan="7" class="empty">— ยังไม่มี access log (ลองเปิดเว็บสัก 2-3 หน้าแล้วรีเฟรช) —</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <PagerBar :total="access.total" :page="access.page" :totalPages="access.totalPages" @go="p => loadAccess(p)" />
            </section>
        </main>
    </div>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from "vue";
import api from "../api";
import TopBar from "../components/TopBar.vue";
import PagerBar from "../components/PagerBar.vue";

const tab = ref("activity");
const busy = ref(false);
const error = ref("");
const activity = reactive({ rows: [], total: 0, page: 1, totalPages: 1 });
const access = reactive({ rows: [], total: 0, page: 1, totalPages: 1 });
let timer = null;

function fmtTime(iso) {
    if (!iso) return "-";
    const d = new Date(iso);
    return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "medium" });
}

function statusClass(code) {
    if (code < 400) return "ok";
    if (code < 500) return "warn";
    return "err";
}

async function loadActivity(page = 1) {
    try {
        const res = await api.get("/activity-log?page=" + page + "&perPage=10");
        activity.rows = res.rows;
        activity.total = res.total;
        activity.page = res.page;
        activity.totalPages = res.totalPages;
        error.value = "";
    } catch (err) {
        error.value = err.message || "โหลด Activity log ไม่สำเร็จ";
    }
}

async function loadAccess(page = 1) {
    try {
        const res = await api.get("/system/access-log?page=" + page + "&perPage=10");
        access.rows = res.rows;
        access.total = res.total;
        access.page = res.page;
        access.totalPages = res.totalPages;
        error.value = "";
    } catch (err) {
        error.value = err.message || "โหลด Access log ไม่สำเร็จ";
    }
}

function switchTab(next) {
    tab.value = next;
    if (next === "activity") loadActivity(activity.page || 1);
    else loadAccess(access.page || 1);
}

async function loadCurrent() {
    busy.value = true;
    if (tab.value === "activity") await loadActivity(activity.page);
    else await loadAccess(access.page);
    busy.value = false;
}

onMounted(() => {
    loadActivity(1);
    timer = setInterval(() => {
        if (tab.value === "access") loadAccess(access.page);
        else loadActivity(activity.page);
    }, 5000); // refresh อัตโนมัติทุก 5 วินาที
});
onUnmounted(() => {
    if (timer) clearInterval(timer);
});
</script>

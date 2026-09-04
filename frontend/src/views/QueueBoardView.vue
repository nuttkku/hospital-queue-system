<template>
    <div class="app-shell">
        <TopBar />

        <main class="container">
            <!-- เพิ่มคิวใหม่: admin + receptionist -->
            <div v-if="canAdd" class="input-group">
                <input
                    v-model.trim="newName"
                    type="text"
                    placeholder="กรุณากรอกชื่อผู้ป่วย..."
                    @keydown.enter.prevent="add"
                />
                <button :disabled="busy.add" @click="add">➕ เพิ่มคิว</button>
            </div>

            <div class="board">
                <section v-for="col in columns" :key="col.key" class="col" :class="'col-' + col.key">
                    <h2>
                        {{ col.icon }} {{ col.label }}
                        <span class="count">{{ counts[col.key] }}</span>
                    </h2>

                    <div class="list">
                        <div v-if="!data[col.key] || data[col.key].length === 0" class="empty">— ว่าง —</div>
                        <div
                            v-for="(name, i) in data[col.key]"
                            :key="col.key + '-' + i"
                            class="card"
                            :class="col.key"
                        >
                            <span class="no">#{{ i + 1 }}</span>
                            <span class="name">{{ name }}</span>
                            <button
                                v-if="advanceLabels[col.key] && canAdvance"
                                class="advance"
                                :disabled="busy.move"
                                @click="move(col.key, i)"
                            >
                                {{ advanceLabels[col.key] }}
                            </button>
                        </div>
                    </div>
                </section>
            </div>

            <div class="actions">
                <button v-if="canClearWaiting" class="clear-btn" @click="clearWaiting">🗑️ ล้างคิวที่รอตรวจ</button>
                <button v-if="canClearAll" class="clear-btn" @click="clearAll">🧹 ล้างข้อมูลทั้งหมด</button>
            </div>

            <p v-if="permissionHint" class="permission-hint">🔒 {{ permissionHint }}</p>
        </main>
    </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import api from "../api";
import { auth, logout } from "../store/auth";
import TopBar from "../components/TopBar.vue";

const router = useRouter();

const columns = [
    { key: "waiting", icon: "🕐", label: "รอตรวจ" },
    { key: "checking", icon: "🩺", label: "กำลังตรวจ" },
    { key: "done", icon: "✅", label: "ตรวจเสร็จ" },
];
const advanceLabels = {
    waiting: "เริ่มตรวจ ▶",
    checking: "✓ ตรวจเสร็จ",
    done: null,
};

const data = reactive({ waiting: [], checking: [], done: [] });
const newName = ref("");
const busy = reactive({ add: false, move: false, clear: false });
let timer = null;

const counts = computed(() => ({
    waiting: data.waiting.length,
    checking: data.checking.length,
    done: data.done.length,
}));

const role = computed(() => (auth.user ? auth.user.role : null));
const canAdd = computed(() => role.value === "admin" || role.value === "receptionist");
const canAdvance = computed(() => role.value === "admin" || role.value === "doctor");
const canClearWaiting = computed(() => role.value === "admin" || role.value === "receptionist");
const canClearAll = computed(() => role.value === "admin");

const permissionHint = computed(() => {
    if (!auth.user) return "เข้าสู่ระบบก่อนใช้งาน";
    if (role.value === "receptionist") return "เจ้าหน้าที่รับคิว: เพิ่มคิว / ล้างคิวที่รอตรวจ ได้ (การเลื่อนสถานะทำโดยแพทย์)";
    if (role.value === "doctor") return "แพทย์: เลื่อนสถานะ (เริ่มตรวจ / ตรวจเสร็จ) ได้ (การเพิ่มคิวทำโดยเจ้าหน้าที่)";
    return "ผู้ดูแลระบบ: ควบคุมได้ทุกอย่าง รวมถึงจัดการผู้ใช้";
});

async function load() {
    try {
        const res = await api.get("/queue");
        data.waiting = res.waiting;
        data.checking = res.checking;
        data.done = res.done;
    } catch (err) {
        if (err.status === 401) {
            await logout();
            router.replace({ name: "login" });
        }
    }
}

async function add() {
    if (!newName.value) {
        alert("⚠️ กรุณากรอกชื่อก่อนเพิ่มคิว");
        return;
    }
    busy.add = true;
    try {
        const res = await api.post("/queue", { name: newName.value });
        apply(res);
        newName.value = "";
    } catch (err) {
        alert("⚠️ " + err.message);
    } finally {
        busy.add = false;
    }
}

async function move(from, index) {
    busy.move = true;
    try {
        const res = await api.post("/queue/move", { from, index });
        apply(res);
    } catch (err) {
        alert("⚠️ " + err.message);
    } finally {
        busy.move = false;
    }
}

async function clearWaiting() {
    if (!confirm("🗑️ ยืนยันล้างคิวที่ยังรอตรวจทั้งหมด?")) return;
    busy.clear = true;
    try {
        const res = await api.post("/queue/clear");
        apply(res);
    } catch (err) {
        alert("⚠️ " + err.message);
    } finally {
        busy.clear = false;
    }
}

async function clearAll() {
    if (!confirm("🧹 จะล้างข้อมูลทุกสถานะ (รอตรวจ / กำลังตรวจ / ตรวจเสร็จ) ทั้งหมด?")) return;
    busy.clear = true;
    try {
        const res = await api.post("/queue/clear-all");
        apply(res);
    } catch (err) {
        alert("⚠️ " + err.message);
    } finally {
        busy.clear = false;
    }
}

function apply(res) {
    data.waiting = res.waiting;
    data.checking = res.checking;
    data.done = res.done;
}

onMounted(() => {
    load();
    timer = setInterval(load, 5000); // refresh แบบ Real-time
});
onUnmounted(() => {
    if (timer) clearInterval(timer);
});
</script>

<template>
    <div class="login-page">
        <div class="login-card">
            <h1>🌸 ระบบคิวโรงพยาบาล</h1>
            <p class="subtitle">เข้าสู่ระบบเพื่อใช้งาน</p>
            <p v-if="socialError" class="error">⚠️ {{ socialError }}</p>

            <form class="login-form" @submit.prevent="submit">
                <input
                    v-model.trim="username"
                    type="text"
                    placeholder="ชื่อผู้ใช้"
                    autocomplete="username"
                    autofocus
                />
                <input
                    v-model="password"
                    type="password"
                    placeholder="รหัสผ่าน"
                    autocomplete="current-password"
                />
                <p v-if="error" class="error">{{ error }}</p>
                <button type="submit" class="login-btn" :disabled="loading">
                    {{ loading ? "กำลังเข้าสู่ระบบ..." : "🔐 เข้าสู่ระบบ" }}
                </button>
            </form>

            <div class="demo-accounts">
                <p class="demo-title">💡 บัญชีทดลอง (กดเพื่อกรอก)</p>
                <button
                    v-for="acc in demo"
                    :key="acc.username"
                    type="button"
                    class="demo-btn"
                    @click="fillAndLogin(acc)"
                >
                    <span>{{ acc.label }}</span>
                    <code>{{ acc.username }} / {{ acc.password }}</code>
                </button>
                <p class="demo-note">🔐 บัญชีทุกบัญชีต้องผ่าน 2FA — ครั้งแรกต้องสแกน QR ด้วย Google Authenticator</p>
            </div>

            <!-- Social Login: แสดงปุ่มทั้ง 3 เสมอ (ปุ่มไหนยังไม่ได้ตั้งค่า = จาง กดแล้วมีคำแนะนำ) -->
            <div class="social-login-box">
                <div class="social-divider"><span>หรือเข้าสู่ระบบด้วย</span></div>
                <button
                    v-for="p in socialProviders"
                    :key="p.id"
                    type="button"
                    class="social-login-btn"
                    :class="[p.configured ? 'slb-' + p.id : 'slb-disabled']"
                    @click="socialLogin(p)"
                >
                    เข้าสู่ระบบด้วย {{ p.label }}
                </button>
                <p class="demo-note">
                    🔐 บัญชีที่ login ผ่าน Social ถูกสร้างอัตโนมัติและต้องตั้ง 2FA เช่นกัน —
                    ปุ่มจาง = admin ยังไม่ได้ตั้งค่า (เมนู 🔗 Social Login)
                </p>
            </div>
        </div>
    </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "../api";
import { login } from "../store/auth";

const router = useRouter();
const route = useRoute();

const username = ref("");
const password = ref("");
const error = ref("");
const socialError = ref("");
const loading = ref(false);

// ปุ่ม Social Login — แสดงทั้ง 3 เสมอ (สถานะ configured อัปเดตจาก backend)
const socialProviders = ref([
    { id: "facebook", label: "Facebook", configured: false },
    { id: "google", label: "Google", configured: false },
    { id: "line", label: "LINE", configured: false },
]);

const demo = [
    { label: "👑 ผู้ดูแลระบบ", username: "admin", password: "admin123" },
    { label: "🖥️ เจ้าหน้าที่รับคิว", username: "receptionist", password: "reception123" },
    { label: "🩺 แพทย์", username: "doctor", password: "doctor123" },
];

// โหลดรายชื่อ provider social ที่พร้อมใช้ + ข้อความ error ถ้ามี (จาก callback)
onMounted(async () => {
    const socialErr = route.query.social_error;
    if (socialErr) {
        socialError.value = typeof socialErr === "string" ? socialErr : "เข้าสู่ระบบ Social ไม่สำเร็จ";
        history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    try {
        const res = await api.get("/auth/social/providers");
        const statusById = {};
        for (const p of res.providers || []) statusById[p.id] = Boolean(p.configured);
        socialProviders.value = socialProviders.value.map((p) => ({
            ...p,
            configured: Boolean(statusById[p.id]),
        }));
    } catch {
        // เรียกไม่ได้ → ทุกปุ่มเป็น "ยังไม่ตั้งค่า" (จาง)
    }
});

function socialLogin(p) {
    if (!p.configured) {
        alert(`⚠️ ยังไม่ได้ตั้งค่า ${p.label}\nให้ผู้ดูแลระบบไปตั้งค่าที่เมนู "🔗 Social Login" ก่อน`);
        return;
    }
    window.location.href = "/api/auth/social/" + p.id + "/start";
}

async function submit() {
    error.value = "";
    loading.value = true;
    try {
        const data = await login(username.value, password.value);
        if (data.stage === "setup_required") {
            router.replace({ name: "2fa-setup" });
            return;
        }
        if (data.stage === "verify_required") {
            router.replace({ name: "2fa-verify" });
            return;
        }
        router.replace(String(route.query.redirect || "/"));
    } catch (err) {
        error.value = err.message || "เข้าสู่ระบบไม่สำเร็จ";
    } finally {
        loading.value = false;
    }
}

async function fillAndLogin(acc) {
    username.value = acc.username;
    password.value = acc.password;
    await submit();
}
</script>

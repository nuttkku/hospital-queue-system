<template>
    <div class="login-page">
        <div class="login-card">
            <h1>🌸 ระบบคิวโรงพยาบาล</h1>
            <p class="subtitle">เข้าสู่ระบบเพื่อใช้งาน</p>

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
        </div>
    </div>
</template>

<script setup>
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import { login } from "../store/auth";

const router = useRouter();
const route = useRoute();

const username = ref("");
const password = ref("");
const error = ref("");
const loading = ref(false);

const demo = [
    { label: "👑 ผู้ดูแลระบบ", username: "admin", password: "admin123" },
    { label: "🖥️ เจ้าหน้าที่รับคิว", username: "receptionist", password: "reception123" },
    { label: "🩺 แพทย์", username: "doctor", password: "doctor123" },
];

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

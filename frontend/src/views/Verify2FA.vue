<template>
    <div class="login-page">
        <div class="login-card">
            <h1>🛡️ ยืนยันตัวตน 2FA</h1>
            <p class="subtitle">
                {{ pendingName }} — กรอกรหัส 6 หลักจากแอป Authenticator หรือ Backup Code (XXXX-XXXX)
            </p>

            <p v-if="error" class="error">{{ error }}</p>

            <form class="login-form" @submit.prevent="verify">
                <input
                    v-model.trim="code"
                    autocomplete="one-time-code"
                    placeholder="123456 หรือ XXXX-XXXX"
                    required
                />
                <button type="submit" class="login-btn" :disabled="submitting">
                    {{ submitting ? "กำลังยืนยัน..." : "✅ ยืนยัน" }}
                </button>
            </form>

            <p class="back-link" @click="backToLogin">← กลับไปหน้าเข้าสู่ระบบ</p>
        </div>
    </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useRouter } from "vue-router";
import api from "../api";
import { auth, complete2FA, logout } from "../store/auth";

const router = useRouter();

const code = ref("");
const error = ref("");
const submitting = ref(false);

const pendingName = computed(() => {
    const u = auth.pending;
    return u ? `${u.name || u.username} (${u.username})` : "ผู้ใช้นี้";
});

async function verify() {
    if (!code.value) {
        error.value = "กรุณากรอกรหัสยืนยัน";
        return;
    }
    error.value = "";
    submitting.value = true;
    try {
        const data = await api.post("/auth/2fa/verify", { code: code.value });
        await complete2FA(data); // ระบบตั้ง session ให้แล้ว
        router.replace("/");
    } catch (err) {
        error.value = err.message || "รหัสยืนยันไม่ถูกต้อง";
    } finally {
        submitting.value = false;
    }
}

async function backToLogin() {
    await logout();
    router.replace({ name: "login" });
}
</script>

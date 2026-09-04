<template>
    <div class="login-page">
        <div class="login-card">
            <h1>🔐 ตั้งค่า 2FA</h1>
            <p class="subtitle">
                {{ pendingName }} ยังไม่ได้ตั้งค่า 2FA — กรุณาสแกน QR แล้วกรอกรหัส 6 หลักเพื่อเปิดใช้งาน
            </p>

            <p v-if="error" class="error">{{ error }}</p>
            <p v-if="loading" class="subtitle">กำลังสร้าง secret ของคุณ...</p>

            <!-- ขั้นตอน 1: แสดง QR + secret -->
            <template v-if="!loading && !backupCodes.length">
                <img v-if="qrCodeDataUrl" class="qr-img" :src="qrCodeDataUrl" alt="QR code สำหรับ Google Authenticator" />
                <p class="hint">📱 ใช้ Google Authenticator / Authy สแกน QR นี้</p>
                <p class="hint">สแกนไม่ได้? กรอก secret นี้ด้วยมือ:</p>
                <div class="code-block">{{ secret }}</div>

                <form class="login-form" @submit.prevent="confirm">
                    <input
                        v-model.trim="code"
                        inputmode="numeric"
                        autocomplete="one-time-code"
                        maxlength="6"
                        placeholder="รหัส 6 หลักจากแอป"
                        required
                    />
                    <button type="submit" class="login-btn" :disabled="submitting">
                        {{ submitting ? "กำลังยืนยัน..." : "✅ เปิดใช้ 2FA" }}
                    </button>
                </form>
            </template>

            <!-- ขั้นตอน 2: Backup codes (แสดงครั้งเดียว) -->
            <template v-if="backupCodes.length">
                <p class="subtitle" style="color: #c92a2a; font-weight: 700;">
                    ⚠️ บันทึก Backup Codes เหล่านี้ไว้ในที่ปลอดภัย — แต่ละรหัสใช้ได้ครั้งเดียวเท่านั้น
                </p>
                <div class="backup-code-grid">
                    <code v-for="(c, i) in backupCodes" :key="i" class="backup-code-item">{{ c }}</code>
                </div>
                <button class="login-btn" @click="finish">🚀 เริ่มใช้งานระบบ</button>
            </template>

            <p class="back-link" @click="backToLogin">← กลับไปหน้าเข้าสู่ระบบ</p>
        </div>
    </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import api from "../api";
import { auth, complete2FA, logout } from "../store/auth";

const router = useRouter();

const qrCodeDataUrl = ref("");
const secret = ref("");
const code = ref("");
const error = ref("");
const loading = ref(true);
const submitting = ref(false);
const backupCodes = ref([]);

const pendingName = computed(() => {
    const u = auth.pending;
    return u ? `${u.name || u.username} (${u.username})` : "ผู้ใช้นี้";
});

onMounted(async () => {
    try {
        const data = await api.post("/auth/2fa/setup");
        qrCodeDataUrl.value = data.qrCodeDataUrl;
        secret.value = data.secret;
    } catch (err) {
        error.value = err.message || "เริ่มตั้งค่า 2FA ไม่สำเร็จ";
        if (err.status === 401) {
            setTimeout(() => router.replace({ name: "login" }), 1800);
        }
    } finally {
        loading.value = false;
    }
});

async function confirm() {
    if (!code.value) {
        error.value = "กรุณากรอกรหัส 6 หลัก";
        return;
    }
    error.value = "";
    submitting.value = true;
    try {
        const data = await api.post("/auth/2fa/setup/confirm", { code: code.value });
        backupCodes.value = data.backupCodes || [];
        await complete2FA(data); // ระบบตั้ง session ให้แล้ว
    } catch (err) {
        error.value = err.message || "รหัสยืนยันไม่ถูกต้อง";
    } finally {
        submitting.value = false;
    }
}

function finish() {
    router.replace("/");
}

async function backToLogin() {
    await logout();
    router.replace({ name: "login" });
}
</script>

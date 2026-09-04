<template>
    <div class="app-shell">
        <TopBar />
        <main class="container">
            <h1 class="page-title">🔗 Social Login (ตั้งค่า)</h1>
            <p class="subtitle">ตั้งค่าให้ผู้ใช้ login ผ่าน Facebook / Google / LINE ได้</p>

            <div v-if="notice" class="notice">{{ notice }}</div>
            <p v-if="error" class="error">{{ error }}</p>

            <div v-for="p in providers" :key="p.id" class="social-card">
                <div class="social-head">
                    <span class="social-icon" :class="'ic-' + p.id">
                        {{ p.id === 'facebook' ? 'f' : p.id === 'google' ? 'G' : 'LINE' }}
                    </span>
                    <h3>{{ p.label }}</h3>
                    <span class="role-badge" :class="p.configured ? 'role-admin' : 'role-receptionist'">
                        {{ p.configured ? 'พร้อมใช้งาน' : 'ยังไม่ครบ' }}
                    </span>
                    <label class="switch" :title="p.enabled ? 'ปิดใช้งาน' : 'เปิดใช้งาน'">
                        <input type="checkbox" v-model="p.enabled" />
                        <span class="slider"></span>
                    </label>
                </div>

                <div class="social-fields">
                    <label>
                        <span>{{ fieldLabel(p.id) }}</span>
                        <input v-model.trim="p.clientId" type="text" :placeholder="'กรอก ' + fieldLabel(p.id)" />
                    </label>
                    <label>
                        <span>{{ secretLabel(p.id) }} <em v-if="p.hasSecret">(เว้นว่าง = คงค่าเดิม)</em></span>
                        <input v-model="p.secret" type="password" :placeholder="p.hasSecret ? '••••••••••' : 'กรอก ' + secretLabel(p.id)" autocomplete="new-password" />
                    </label>
                </div>

                <div class="callback-row">
                    <span>Callback URL</span>
                    <code>{{ p.callbackUrl }}</code>
                    <button type="button" class="mini-btn" @click="copy(p.callbackUrl)">คัดลอก</button>
                </div>

                <p class="social-help">{{ helpText(p.id) }}</p>

                <button class="save-btn" :disabled="busyId === p.id" @click="save(p)">
                    {{ busyId === p.id ? "กำลังบันทึก..." : "💾 บันทึก " + p.label }}
                </button>
            </div>
        </main>
    </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import api from "../api";
import TopBar from "../components/TopBar.vue";

const providers = ref([]);
const notice = ref("");
const error = ref("");
const busyId = ref("");

async function load() {
    try {
        const res = await api.get("/settings/social");
        providers.value = res.providers.map((p) => ({ ...p, secret: "" }));
    } catch (err) {
        error.value = err.message || "โหลดข้อมูลไม่สำเร็จ";
    }
}

function fieldLabel(id) {
    return { facebook: "App ID", google: "Client ID", line: "Channel ID" }[id] || "Client ID";
}

function secretLabel(id) {
    return { facebook: "App Secret", google: "Client Secret", line: "Channel Secret" }[id] || "Secret";
}

function helpText(id) {
    if (id === "facebook") {
        return "สร้างแอปที่ developers.facebook.com → เลือก 'Facebook Login' → ใส่ callback URL ด้านบนใน Valid OAuth Redirect URIs แล้วกดบันทึก";
    }
    if (id === "google") {
        return "สร้าง OAuth 2.0 Client ID ที่ console.cloud.google.com → Authorized redirect URIs ใส่ callback URL ด้านบน แล้วเปิดใช้ scopes: openid, email, profile";
    }
    return "สร้าง Channel (LINE Login) ที่ developers.line.biz → ใส่ callback URL ใน LINE Login → Redirect URL แล้วเปิดใช้ scope: openid profile";
}

async function save(p) {
    busyId.value = p.id;
    try {
        await api.put("/settings/social", {
            provider: p.id,
            enabled: p.enabled,
            clientId: p.clientId,
            secret: p.secret || undefined,
        });
        notice.value = "✅ บันทึก " + p.label + " เรียบร้อย";
        setTimeout(() => { notice.value = ""; }, 2500);
        p.secret = "";
        await load(); // refresh สถานะ configured
    } catch (err) {
        alert("⚠️ " + err.message);
    } finally {
        busyId.value = "";
    }
}

async function copy(text) {
    try {
        await navigator.clipboard.writeText(text);
        alert("✅ คัดลอก Callback URL แล้ว");
    } catch {
        alert("คัดลอกด้วยมือ: " + text);
    }
}

onMounted(load);
</script>

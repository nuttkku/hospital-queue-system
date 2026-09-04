<template>
    <div>
        <router-view v-if="auth.ready" />
        <!-- AI Chatbot แสดงเฉพาะเมื่อ login แล้ว -->
        <ChatBot v-if="auth.ready && auth.user" />
    </div>
</template>

<script setup>
import { watch } from "vue";
import { useRoute } from "vue-router";
import api from "./api";
import { auth } from "./store/auth";
import ChatBot from "./components/ChatBot.vue";

const route = useRoute();

// แผนที่ชื่อ route -> ชื่อเมนูภาษาไทย (สำหรับบันทึกลง Activity Log)
const PAGE_LABELS = {
    board: "กระดานคิว",
    users: "จัดการผู้ใช้",
    system: "เซิร์ฟเวอร์/ตรวจสอบระบบ",
    settings: "Social Login (ตั้งค่า)",
    logs: "Activity Log",
};

let lastLoggedPath = "";
// บันทึกทุกครั้งที่ผู้ใช้ "กดเมนู/เปลี่ยนหน้า" (เฉพาะตอน login แล้ว)
watch(
    () => route.fullPath,
    async (path) => {
        if (!auth.ready || !auth.user) return;
        if (lastLoggedPath === path) return;
        const name = typeof route.name === "string" ? route.name : "";
        if (["login", "2fa-setup", "2fa-verify"].includes(name)) return;
        lastLoggedPath = path;
        try {
            await api.post("/audit/page", {
                page: path,
                label: PAGE_LABELS[name] || name || path,
            });
        } catch { /* ข้ามถ้าบันทึกไม่ได้ */ }
    }
);
</script>

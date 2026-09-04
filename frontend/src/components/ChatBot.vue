<template>
    <div class="chat-widget">
        <!-- ปุ่มเปิดแชท -->
        <button v-if="!open" class="chat-fab" title="ถามวิธีใช้งานระบบ" @click="toggle">
            🤖<span class="chat-fab-hint">ถามวิธีใช้?</span>
        </button>

        <!-- หน้าต่างแชท -->
        <div v-if="open" class="chat-panel">
            <div class="chat-header">
                <span class="chat-title">🌸 ผู้ช่วยใช้งานระบบ</span>
                <span class="chat-sub">AI ช่วยตอบคำถามวิธีใช้ (DeepSeek)</span>
                <button class="chat-close" title="ปิด" @click="toggle">✕</button>
            </div>

            <div ref="bodyEl" class="chat-body">
                <!-- คำแนะนำแรก -->
                <div v-if="!messages.length" class="chat-intro">
                    <p>สวัสดีครับ 👋 พิมพ์คำถามเกี่ยวกับวิธีใช้ระบบได้เลย เช่น</p>
                    <div class="chat-chips">
                        <button v-for="q in quickQuestions" :key="q" class="chat-chip" @click="quick(q)">{{ q }}</button>
                    </div>
                </div>

                <div
                    v-for="(m, i) in messages"
                    :key="i"
                    class="chat-msg"
                    :class="m.role"
                >
                    {{ m.content }}
                </div>

                <div v-if="busy" class="chat-msg assistant chat-typing">
                    <span class="dot"></span><span class="dot"></span><span class="dot"></span>
                </div>
            </div>

            <form class="chat-input-row" @submit.prevent="send">
                <input
                    v-model.trim="text"
                    type="text"
                    placeholder="พิมพ์คำถามวิธีใช้งานระบบ..."
                    autocomplete="off"
                />
                <button type="submit" :disabled="busy || !text">ส่ง</button>
            </form>
        </div>
    </div>
</template>

<script setup>
import { nextTick, ref } from "vue";
import api from "../api";

const open = ref(false);
const busy = ref(false);
const text = ref("");
const messages = ref([]);
const bodyEl = ref(null);

const quickQuestions = [
    "เพิ่มคิวผู้ป่วยยังไง?",
    "แพทย์ทำอะไรได้บ้าง?",
    "ล้างคิวที่รอตรวจทำยังไง?",
    "จัดการผู้ใช้อย่างไร?",
    "2FA คืออะไร?",
];

function toggle() {
    open.value = !open.value;
}

async function scrollBottom() {
    await nextTick();
    if (bodyEl.value) bodyEl.value.scrollTop = bodyEl.value.scrollHeight;
}

function quick(q) {
    text.value = q;
    send();
}

async function send() {
    const message = text.value;
    if (!message || busy.value) return;
    text.value = "";
    messages.value.push({ role: "user", content: message });
    busy.value = true;
    await scrollBottom();

    try {
        // ส่งประวัติล่าสุด (ไม่รวมข้อความที่กำลังพิมพ์) ให้ AI มีบริบทต่อเนื่อง
        const history = messages.value.slice(0, -1).map((m) => ({
            role: m.role,
            content: m.content,
        }));
        const data = await api.post("/chat", { message, history });
        messages.value.push({ role: "assistant", content: data.reply });
    } catch (err) {
        messages.value.push({
            role: "assistant",
            content: "⚠️ " + (err.message || "ขออภัย เกิดข้อผิดพลาดในการติดต่อ AI"),
        });
    } finally {
        busy.value = false;
        await scrollBottom();
    }
}
</script>

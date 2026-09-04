<template>
    <div>
        <router-view v-if="auth.ready" />
        <!-- AI Chatbot แสดงเฉพาะเมื่อ login แล้ว -->
        <ChatBot v-if="auth.ready && auth.user" />
    </div>
</template>

<script setup>
import { auth } from "./store/auth";
import ChatBot from "./components/ChatBot.vue";
</script>

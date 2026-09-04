<template>
    <header class="topbar">
        <div class="topbar-inner">
            <div class="brand">
                <router-link to="/" class="brand-title">🌸 ระบบคิวโรงพยาบาล</router-link>
                <span class="brand-sub">โรงพยาบาลสีชมพู ✨</span>
            </div>

            <nav v-if="auth.user" class="nav">
                <router-link to="/" class="nav-link">📋 กระดานคิว</router-link>
                <router-link v-if="auth.user.role === 'admin'" to="/system" class="nav-link">🖥️ เซิร์ฟเวอร์</router-link>
                <router-link v-if="auth.user.role === 'admin'" to="/settings" class="nav-link">🔗 Social Login</router-link>
                <router-link v-if="auth.user.role === 'admin'" to="/users" class="nav-link">👥 จัดการผู้ใช้</router-link>
            </nav>

            <div v-if="auth.user" class="userbox">
                <span class="user-name">{{ auth.user.name }}</span>
                <span class="role-badge" :class="'role-' + auth.user.role">{{ roleLabel(auth.user.role) }}</span>
                <button class="logout-btn" @click="doLogout">ออกจากระบบ</button>
            </div>
        </div>
    </header>
</template>

<script setup>
import { useRouter } from "vue-router";
import { auth, logout, roleLabel } from "../store/auth";

const router = useRouter();

async function doLogout() {
    await logout();
    router.replace({ name: "login" });
}
</script>

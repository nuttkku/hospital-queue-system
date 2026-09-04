import { createRouter, createWebHistory } from "vue-router";
import { auth, fetchMe } from "../store/auth";
import LoginView from "../views/LoginView.vue";
import Setup2FAView from "../views/Setup2FA.vue";
import Verify2FAView from "../views/Verify2FA.vue";
import QueueBoardView from "../views/QueueBoardView.vue";
import UsersView from "../views/UsersView.vue";
import ServerStats from "../views/ServerStats.vue";
import SettingsView from "../views/SettingsView.vue";
import ActivityLog from "../views/ActivityLog.vue";

const router = createRouter({
    history: createWebHistory(),
    routes: [
        { path: "/login", name: "login", component: LoginView, meta: { public: true } },
        { path: "/2fa/setup", name: "2fa-setup", component: Setup2FAView, meta: { public: true } },
        { path: "/2fa/verify", name: "2fa-verify", component: Verify2FAView, meta: { public: true } },
        { path: "/", name: "board", component: QueueBoardView },
        { path: "/users", name: "users", component: UsersView, meta: { roles: ["admin"] } },
        { path: "/system", name: "system", component: ServerStats, meta: { roles: ["admin"] } },
        { path: "/settings", name: "settings", component: SettingsView, meta: { roles: ["admin"] } },
        { path: "/logs", name: "logs", component: ActivityLog, meta: { roles: ["admin"] } },
        { path: "/:pathMatch(.*)*", redirect: "/" },
    ],
});

// ตรวจ login + บทบาทก่อนเข้าแต่ละหน้า
router.beforeEach(async (to) => {
    if (!auth.ready) {
        await fetchMe();
    }

    if (to.meta.public) {
        // เข้า login/หน้า 2FA แล้ว แต่ login session มีอยู่แล้ว -> ไปหน้าหลัก
        if (auth.user) return { name: "board" };
        return true;
    }

    if (!auth.user) {
        return { name: "login", query: { redirect: to.fullPath } };
    }

    if (to.meta.roles && !to.meta.roles.includes(auth.user.role)) {
        return { name: "board" };
    }

    return true;
});

export default router;

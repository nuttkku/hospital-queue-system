import { reactive } from "vue";
import api from "../api";

// สถานะผู้ใช้ปัจจุบัน (แชร์ทั่วทั้งแอป)
export const auth = reactive({
    user: null,
    ready: false,
    // ผู้ใช้ที่ผ่านขั้นตอนรหัสผ่านแล้ว กำลังรอทำ 2FA (setup/verify)
    pending: null,
});

export const ROLE_LABELS = {
    admin: "ผู้ดูแลระบบ",
    receptionist: "เจ้าหน้าที่รับคิว",
    doctor: "แพทย์",
};

export function roleLabel(role) {
    return ROLE_LABELS[role] || role || "";
}

export async function fetchMe() {
    try {
        const data = await api.get("/auth/me");
        auth.user = data.user;
    } catch {
        auth.user = null;
    } finally {
        auth.ready = true;
    }
}

// POST /api/auth/login — ถ้ายังไม่ผ่าน 2FA ระบบจะคืน { stage, user } และยังไม่ตั้ง session
export async function login(username, password) {
    const data = await api.post("/auth/login", { username, password });
    auth.ready = true;
    if (data.stage) {
        auth.user = null;
        auth.pending = data.user || null;
        return data; // { stage: 'setup_required' | 'verify_required', user }
    }
    auth.user = data.user || null;
    auth.pending = null;
    return data;
}

// เรียกหลังผ่าน 2FA สำเร็จ (setup/confirm หรือ verify) — ระบบตั้ง session ให้แล้ว
export async function complete2FA(data) {
    auth.user = data.user || null;
    auth.pending = null;
    auth.ready = true;
    return auth.user;
}

export async function logout() {
    try {
        await api.post("/auth/logout");
    } finally {
        auth.user = null;
        auth.pending = null;
    }
}


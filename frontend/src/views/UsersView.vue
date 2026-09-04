<template>
    <div class="app-shell">
        <TopBar />

        <main class="container">
            <h1 class="page-title">👥 จัดการผู้ใช้</h1>

            <div v-if="notice" class="notice">{{ notice }}</div>

            <!-- ฟอร์มเพิ่มผู้ใช้ -->
            <div class="user-form">
                <h3>➕ เพิ่มผู้ใช้ใหม่</h3>
                <div class="user-form-row">
                    <input v-model.trim="form.username" type="text" placeholder="ชื่อผู้ใช้ (login)" />
                    <input v-model.trim="form.name" type="text" placeholder="ชื่อ-นามสกุล" />
                    <input v-model="form.password" type="password" placeholder="รหัสผ่าน" />
                    <select v-model="form.role">
                        <option value="receptionist">เจ้าหน้าที่รับคิว</option>
                        <option value="doctor">แพทย์</option>
                        <option value="admin">ผู้ดูแลระบบ</option>
                    </select>
                    <button :disabled="busy" @click="createUser">เพิ่มผู้ใช้</button>
                </div>
            </div>

            <!-- ตารางผู้ใช้ -->
            <div class="table-wrap">
                <table class="user-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>ชื่อผู้ใช้</th>
                            <th>ชื่อ-นามสกุล</th>
                            <th>บทบาท</th>
                            <th>2FA</th>
                            <th>สร้างเมื่อ</th>
                            <th>จัดการ</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(u, i) in users" :key="u.id">
                            <td>{{ i + 1 }}</td>
                            <td><code>{{ u.username }}</code></td>
                            <td>{{ u.name }}</td>
                            <td>
                                <select :value="u.role" @change="changeRole(u, $event.target.value)">
                                    <option value="receptionist">เจ้าหน้าที่รับคิว</option>
                                    <option value="doctor">แพทย์</option>
                                    <option value="admin">ผู้ดูแลระบบ</option>
                                </select>
                            </td>
                            <td>
                                <span v-if="u.totp_enabled" class="totp-on">✅ เปิด</span>
                                <span v-else class="totp-off">— ปิด —</span>
                            </td>
                            <td>{{ formatDate(u.created_at) }}</td>
                            <td class="row-actions">
                                <button class="mini-btn" title="แก้ไขชื่อ" @click="renameUser(u)">✏️</button>
                                <button class="mini-btn" title="รีเซ็ตรหัสผ่าน" @click="resetPassword(u)">🔑</button>
                                <button class="mini-btn" title="รีเซ็ต 2FA (ให้ตั้งค่าใหม่ตอน login ครั้งหน้า)" @click="resetTwoFa(u)">🔐</button>
                                <button
                                    class="mini-btn danger"
                                    title="ลบผู้ใช้"
                                    :disabled="u.id === auth.user.id"
                                    @click="removeUser(u)"
                                >🗑️</button>
                            </td>
                        </tr>
                        <tr v-if="!users.length">
                            <td colspan="7" class="empty">— ไม่พบผู้ใช้ —</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </main>
    </div>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import api from "../api";
import { auth } from "../store/auth";
import TopBar from "../components/TopBar.vue";

const users = ref([]);
const notice = ref("");
const busy = ref(false);
const form = reactive({ username: "", name: "", password: "", role: "receptionist" });

async function load() {
    try {
        const res = await api.get("/users");
        users.value = res.users;
    } catch (err) {
        alert("⚠️ " + err.message);
    }
}

function flash(msg) {
    notice.value = msg;
    setTimeout(() => { notice.value = ""; }, 3000);
}

async function createUser() {
    if (!form.username || !form.name || !form.password) {
        alert("⚠️ กรุณากรอกข้อมูลให้ครบ");
        return;
    }
    busy.value = true;
    try {
        await api.post("/users", { ...form });
        flash("✅ เพิ่มผู้ใช้ " + form.username + " เรียบร้อย");
        form.username = "";
        form.name = "";
        form.password = "";
        form.role = "receptionist";
        await load();
    } catch (err) {
        alert("⚠️ " + err.message);
    } finally {
        busy.value = false;
    }
}

async function changeRole(u, role) {
    try {
        await api.put("/users/" + u.id, { role });
        flash("✅ เปลี่ยนบทบาทของ " + u.username + " เป็น " + role);
        await load();
    } catch (err) {
        alert("⚠️ " + err.message);
        await load(); // รีเฟรชกลับค่าเดิม
    }
}

async function renameUser(u) {
    const name = prompt("ชื่อ-นามสกุลใหม่ของ " + u.username, u.name);
    if (name === null) return;
    const clean = name.trim();
    if (!clean) { alert("ชื่อห้ามว่าง"); return; }
    try {
        await api.put("/users/" + u.id, { name: clean });
        flash("✅ แก้ไขชื่อเรียบร้อย");
        await load();
    } catch (err) {
        alert("⚠️ " + err.message);
    }
}

async function resetPassword(u) {
    const pwd = prompt("รหัสผ่านใหม่สำหรับ " + u.username + " (อย่างน้อย 4 ตัว)");
    if (!pwd) return;
    try {
        await api.put("/users/" + u.id, { password: pwd });
        flash("✅ เปลี่ยนรหัสผ่านของ " + u.username + " เรียบร้อย");
    } catch (err) {
        alert("⚠️ " + err.message);
    }
}

async function resetTwoFa(u) {
    if (!confirm("🔐 ยืนยันรีเซ็ต 2FA ของ " + u.username + "?\nผู้ใช้นี้จะต้องตั้งค่า 2FA ใหม่ในการ login ครั้งหน้า (ไม่ใช่ทางลัดข้าม 2FA)")) return;
    try {
        await api.post("/users/" + u.id + "/reset-2fa");
        flash("✅ รีเซ็ต 2FA ของ " + u.username + " เรียบร้อย");
        await load();
    } catch (err) {
        alert("⚠️ " + err.message);
    }
}

async function removeUser(u) {
    if (!confirm("🗑️ ยืนยันลบผู้ใช้ " + u.username + "?")) return;
    try {
        await api.delete("/users/" + u.id);
        flash("✅ ลบผู้ใช้ " + u.username + " เรียบร้อย");
        await load();
    } catch (err) {
        alert("⚠️ " + err.message);
    }
}

function formatDate(value) {
    if (!value) return "-";
    const d = new Date(value);
    return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

onMounted(load);
</script>

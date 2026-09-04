# 🏥 Hospital Queue System

> 🌸 ระบบคิวโรงพยาบาลโทนสีชมพู — เข้าใช้งานด้วยบัญชีและสิทธิ์ตามบทบาท (RBAC) รันด้วย **Docker** จัดเก็บข้อมูลด้วย **MariaDB** — Frontend **Vue 3** + Backend **Express.js**

---

## ✨ ฟีเจอร์เด่น

| ฟีเจอร์ | รายละเอียด |
|--------|------------|
| 🔐 **Login / RBAC** | เข้าสู่ระบบด้วย JWT (httpOnly cookie) แบ่ง 3 บทบาท: **admin** / **receptionist** / **doctor** |
| 🛡️ **บังคับ 2FA (TOTP)** | ทุกบัญชีต้องยืนยัน 2FA ด้วย Google Authenticator (QR + secret เข้ารหัส AES-256-GCM) + Backup codes — ต่อให้รู้รหัสผ่านก็เข้าไม่ได้ถ้าไม่มี 2FA |
| ➕ **เพิ่มคิว** | เจ้าหน้าที่รับคิว/admin กรอกชื่อผู้ป่วย → สถานะ "🕐 รอตรวจ" |
| 🚶 **เลื่อนสถานะ** | แพทย์/admin กด **เริ่มตรวจ ▶** / **ตรวจเสร็จ ✓** |
| 👥 **จัดการผู้ใช้** | admin สร้าง/แก้ไข/ลบผู้ใช้ เปลี่ยนบทบาท และรีเซ็ตรหัสผ่านได้ |
| 📋 **กระดาน 3 คอลัมน์** | แสดงคิวแยกสถานะ Real-time (refresh อัตโนมัติทุก 5 วินาที) พร้อมตัวนับ |
| 🗄️ **MariaDB** | เก็บข้อมูลใน container `db` (volume `db_data` อยู่รอดทุก rebuild) |
| 🐳 **Docker** | แยก 2 container: `db` (MariaDB) + `frontend` (Express + Vue) |
| 🎨 **โทนสีชมพู** | UI สวยงามด้วยเฉดสีชมพูพาสเทล |
| 🛡️ **ปลอดภัย** | รหัสผ่านเข้ารหัส bcrypt, กัน SQL Injection ด้วย parameter, Vue escape ป้องกัน XSS |

---

## 👑 บทบาทและสิทธิ์ (RBAC)

| ความสามารถ | admin | receptionist (เจ้าหน้าที่รับคิว) | doctor (แพทย์) |
|---|:---:|:---:|:---:|
| ดูกระดานคิว | ✅ | ✅ | ✅ |
| เพิ่มคิว | ✅ | ✅ | ❌ |
| ล้างคิวที่รอตรวจ | ✅ | ✅ | ❌ |
| เริ่มตรวจ / ตรวจเสร็จ (เลื่อนสถานะ) | ✅ | ❌ | ✅ |
| ล้างข้อมูลทุกสถานะ | ✅ | ❌ | ❌ |
| จัดการผู้ใช้ (สร้าง/แก้/ลบ) | ✅ | ❌ | ❌ |

> 💡 สิทธิ์บังคับทั้งที่ **Frontend** (ซ่อนปุ่ม/เมนู) และ **Backend** (middleware `allowRoles`) — bypass ผ่าน API ไม่ได้

---

## 🚀 วิธีใช้งาน

### 🐳 รันด้วย Docker (แนะนำ)

```bash
docker compose up -d --build
```

เปิด **http://localhost:3000** แล้วเข้าสู่ระบบด้วยบัญชีเริ่มต้น:

| บทบาท | ชื่อผู้ใช้ | รหัสผ่าน |
|--------|-----------|----------|
| 👑 ผู้ดูแลระบบ | `admin` | `admin123` |
| 🖥️ เจ้าหน้าที่รับคิว | `receptionist` | `reception123` |
| 🩺 แพทย์ | `doctor` | `doctor123` |

> บัญชีเริ่มต้นถูกสร้างเฉพาะครั้งแรกที่ตาราง `users` ยังว่าง
> ⚠️ **ทุกบัญชีต้องตั้งค่า 2FA (TOTP) ครั้งแรกก่อนเข้าใช้งาน** — หลังกดเข้าสู่ระบบ ระบบจะพาไปสแกน QR ด้วย
> Google Authenticator และให้ **Backup Codes** ไว้กู้คืน (admin รีเซ็ต 2FA ให้ได้ที่เมนู 👥 จัดการผู้ใช้)

### 🛑 หยุดการทำงาน

```bash
docker compose down        # หยุด container (ข้อมูลใน volume ยังอยู่)
docker compose down -v     # หยุด + ลบ volume ข้อมูลทั้งหมด
```

---

## 🔧 การตั้งค่า (Environment Variables)

คัดลอก `.env.example` → `.env` แล้วแก้ค่าตามต้องการ:

```bash
cp .env.example .env
```

| ตัวแปร | ค่าเริ่มต้น | ความหมาย |
|--------|-----------|----------|
| `APP_PORT` | `3000` | พอร์ตที่เข้าใช้งานเว็บ |
| `MARIADB_*` | - | ฐานข้อมูล/user/password ของ MariaDB |
| `JWT_SECRET` | dev | **ควรเปลี่ยน** เป็น string ยาว ๆ สุ่ม |
| `COOKIE_SECURE` | `false` | ใส่ `true` เมื่อใช้ HTTPS |
| `SEED_ADMIN_PASSWORD` | `admin123` | รหัสผ่าน admin (seed ครั้งแรก) |
| `SEED_RECEPTIONIST_PASSWORD` | `reception123` | รหัสผ่าน receptionist (seed ครั้งแรก) |
| `SEED_DOCTOR_PASSWORD` | `doctor123` | รหัสผ่าน doctor (seed ครั้งแรก) |

---

## 💻 รันแบบไม่ใช้ Docker (สำหรับพัฒนา)

ต้องมี MariaDB/MySQL และ Node.js >= 18 อยู่แล้ว

**Terminal 1 — Backend (Express + API) บนพอร์ต 3000:**

```bash
cd backend
npm install
DB_HOST=127.0.0.1 DB_USER=queue_user DB_PASSWORD=queue_pass DB_NAME=hospital_queue npm start
```

**Terminal 2 — Frontend (Vite dev server บนพอร์ต 5173 พร้อม proxy /api):**

```bash
cd frontend
npm install
npm run dev
```

เปิด http://localhost:5173

**Build frontend แบบ production (แล้วให้ backend เสิร์ฟ):**

```bash
cd frontend
npm run build      # สร้างไฟล์ที่ frontend/dist
```

---

## 🏗️ โครงสร้างโปรเจกต์

```
📂 hospital-queue-system/
├── 📂 backend/                 # 🚀 Express.js (REST API + JWT/RBAC)
│   ├── 📂 src/
│   │   ├── index.js            # ตั้งค่า Express + เสิร์ฟ static Vue (dist)
│   │   ├── db.js               # ชั้นข้อมูล MariaDB + seed ผู้ใช้เริ่มต้น
│   │   ├── 📂 middleware/
│   │   │   └── auth.js         # JWT + requireAuth + allowRoles (RBAC)
│   │   ├── 📂 routes/
│   │   │   ├── auth.js         # POST /api/auth/login | GET /me | POST /logout
│   │   │   ├── queue.js        # /api/queue/* (เพิ่ม/เลื่อน/ล้าง)
│   │   │   └── users.js        # /api/users/* (admin เท่านั้น)
│   │   └── 📂 utils/
│   │       └── async-handler.js
│   ├── package.json
│   └── package-lock.json
├── 📂 frontend/                # 🌸 Vue 3 + Vite
│   ├── index.html
│   ├── vite.config.js          # dev proxy /api → localhost:3000
│   ├── package.json
│   ├── package-lock.json
│   └── 📂 src/
│       ├── main.js / App.vue / style.css
│       ├── api.js              # ตัวเรียก REST API
│       ├── 📂 store/auth.js    # สถานะผู้ใช้ + login/logout
│       ├── 📂 router/index.js  # guard ตามบทบาท
│       ├── 📂 components/TopBar.vue
│       └── 📂 views/
│           ├── LoginView.vue       # หน้าเข้าสู่ระบบ
│           ├── QueueBoardView.vue  # กระดานคิว (สิทธิ์ตามบทบาท)
│           └── UsersView.vue       # จัดการผู้ใช้ (admin)
├── 📄 Dockerfile               # 🐳 multi-stage: build Vue → runtime Express
├── 📄 docker-compose.yml       # container db + frontend
├── 📄 .env.example             # ตัวอย่าง environment variables
├── 📄 README.md
├── 📄 CLAUDE.md
├── 📄 LICENSE
└── 📄 .gitignore / .dockerignore
```

---

## 🔌 API (ย่อ)

| Method | Path | สิทธิ์ | คำอธิบาย |
|--------|------|--------|----------|
| POST | `/api/auth/login` | ทุกคน | login → ตั้ง httpOnly cookie |
| GET | `/api/auth/me` | ทุกคนที่ login | ข้อมูลผู้ใช้ปัจจุบัน |
| POST | `/api/auth/logout` | ทุกคนที่ login | logout |
| GET | `/api/queue` | ทุกคนที่ login | อ่านคิวทั้ง 3 สถานะ |
| POST | `/api/queue` | admin, receptionist | เพิ่มคิว |
| POST | `/api/queue/move` | admin, doctor | เลื่อนสถานะ |
| POST | `/api/queue/clear` | admin, receptionist | ล้างคิวที่รอตรวจ |
| POST | `/api/queue/clear-all` | admin | ล้างทุกสถานะ |
| GET | `/api/users` | admin | รายชื่อผู้ใช้ |
| POST | `/api/users` | admin | สร้างผู้ใช้ |
| PUT | `/api/users/:id` | admin | แก้ไขชื่อ/บทบาท/รหัสผ่าน |
| DELETE | `/api/users/:id` | admin | ลบผู้ใช้ |

---

## 🧰 เทคโนโลยีที่ใช้

- Vue 3 + Vue Router + Vite
- Node.js + Express.js
- MariaDB (mysql2) + JWT (jsonwebtoken) + bcryptjs
- Docker / Docker Compose

---

## 📜 สัญญาอนุญาต

โครงการนี้อยู่ภายใต้สัญญาอนุญาต **MIT License** — ดูรายละเอียดเพิ่มเติมได้ที่ไฟล์ [LICENSE](./LICENSE)

---

## 👤 ผู้พัฒนา

- **ชื่อ:** Wanut Padee
- **ปี:** 2026

---

> 🌷 **Made with 💖, lots of pink colors, Vue 💚, Express 🚀 and MariaDB 🗄️!**


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
| 🐳 **Docker** | แยก 4 container: `proxy` (nginx HTTPS) + `db` (MariaDB) + `backend` (Express API) + `frontend` (nginx + Vue) |
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

เปิด **https://localhost** แล้วเข้าสู่ระบบด้วยบัญชีเริ่มต้น:

| บทบาท | ชื่อผู้ใช้ | รหัสผ่าน |
|--------|-----------|----------|
| 👑 ผู้ดูแลระบบ | `admin` | `admin123` |
| 🖥️ เจ้าหน้าที่รับคิว | `receptionist` | `reception123` |
| 🩺 แพทย์ | `doctor` | `doctor123` |

> 🔒 **Self-signed certificate** — เบราว์เซอร์จะเตือนว่าไม่ปลอดภัย (เพราะ cert ยังไม่ได้ออกโดย CA)
> ให้กด **Advanced / ขั้นสูง → Proceed to localhost (ไม่ปลอดภัย)** แล้วเข้าใช้งานได้
> (ข้อความเตือนนี้จะหายไปถ้านำ cert ของจริงมาใส่แทนที่ `/etc/nginx/ssl/` ใน container `proxy`)

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
| `HTTPS_PORT` | `443` | พอร์ต HTTPS (nginx proxy) — https://localhost |
| `HTTP_PORT` | `80` | พอร์ต HTTP → redirect ไป HTTPS |
| `MARIADB_PORT` | `3306` | พอร์ต MariaDB ที่เปิดให้ SQL client จาก host |
| `BACKEND_PORT` | (ปิด) | ถ้าอยากเปิด API ตรง ๆ (ดู docker-compose.yml) |
| `MARIADB_*` | - | ฐานข้อมูล/user/password ของ MariaDB |
| `JWT_SECRET` | dev | **ควรเปลี่ยน** เป็น string ยาว ๆ สุ่ม |
| `COOKIE_SECURE` | `true` | cookie Secure (เว็บเป็น HTTPS แล้ว) |
| `SEED_ADMIN_PASSWORD` | `admin123` | รหัสผ่าน admin (seed ครั้งแรก) |
| `SEED_RECEPTIONIST_PASSWORD` | `reception123` | รหัสผ่าน receptionist (seed ครั้งแรก) |
| `SEED_DOCTOR_PASSWORD` | `doctor123` | รหัสผ่าน doctor (seed ครั้งแรก) |

---

## 🔌 เชื่อมต่อฐานข้อมูลด้วย SQL Client (DBeaver / HeidiSQL / MySQL CLI)

เปิดพอร์ต `3306` ออก host ไว้แล้ว — ตั้งค่าการเชื่อมต่อได้ดังนี้:

| ค่า | รายละเอียด |
|---|---|
| **Host** | `127.0.0.1` (localhost) |
| **Port** | `3306` (เปลี่ยนได้ด้วย `MARIADB_PORT`) |
| **User** | `queue_user` |
| **Password** | `queue_pass` |
| **Database** | `hospital_queue` |

ตัวอย่างผ่าน CLI:

```bash
mysql -h 127.0.0.1 -P 3306 -u queue_user -pqueue_pass hospital_queue
```

ตารางหลัก: `users` (ผู้ใช้ + สถานะ 2FA), `patients` (คิว), `queue_seq`, `backup_codes`
> 💡 root password: `queue_root_pass` — ทั้งหมดเปลี่ยนได้ผ่าน `.env` (`MARIADB_*`)

---

## 📦 ข้อมูลอยู่ที่ไหน & ทำให้อยู่ถาวร

ข้อมูลทั้งหมด (ผู้ใช้ คิว การตั้งค่า Social Login ฯลฯ) ถูกเก็บใน **Docker volume `db_data`** ที่ `/var/lib/mysql`
ใน container `db` — **อยู่รอด** การ `docker compose down`, `docker compose restart` และแม้แต่ `docker compose up -d --build` (rebuild image)

```bash
docker volume ls                     # จะเห็น volume ของโปรเจกต์
docker volume inspect hospital-queue-system_db_data   # ดูตำแหน่งจริงบนเครื่อง
```

> ⚠️ ข้อมูลจะ **หายก็ต่อเมื่อ** รัน `docker compose down -v` หรือลบ volume ทิ้งเองเท่านั้น

**สำรอง/กู้คืนข้อมูล (แนะนำก่อนทำอะไรใหญ่ ๆ):**

```bash
# Backup ทั้ง DB ออกเป็นไฟล์
docker compose exec db sh -c "mariadb-dump -u queue_user -pqueue_pass hospital_queue" > backup.sql

# Restore
Get-Content backup.sql | docker compose exec -T db mariadb -u queue_user -pqueue_pass hospital_queue
```

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
├── 📂 backend/                 # 🚀 Express.js (REST API + JWT/RBAC + 2FA) — container: backend
│   ├── 📂 src/
│   │   ├── index.js            # ตั้งค่า Express + ต่อ route (API อย่างเดียว)
│   │   ├── db.js               # ชั้นข้อมูล MariaDB + seed ผู้ใช้เริ่มต้น
│   │   ├── 📂 middleware/
│   │   │   └── auth.js         # JWT + pre-auth (2FA) + requireAuth + allowRoles (RBAC)
│   │   ├── 📂 routes/
│   │   │   ├── auth.js         # login / 2fa setup-verify / me / logout
│   │   │   ├── queue.js        # /api/queue/* (เพิ่ม/เลื่อน/ล้าง)
│   │   │   └── users.js        # /api/users/* (admin เท่านั้น)
│   │   ├── 📂 services/
│   │   │   └── twofa.service.js    # TOTP (otplib) + QR + backup codes
│   │   └── 📂 utils/
│   │       ├── async-handler.js
│   │       └── crypto.js           # เข้ารหัส TOTP secret (AES-256-GCM)
│   ├── Dockerfile              # 🐳 image backend
│   ├── package.json
│   └── package-lock.json
├── 📂 frontend/                # 🌸 Vue 3 + Vite + nginx — container: frontend
│   ├── Dockerfile              # 🐳 build Vue -> nginx (multi-stage)
│   ├── nginx.conf              # เสิร์ฟ static + proxy /api -> backend:3000
│   ├── index.html
│   ├── vite.config.js          # dev proxy /api → localhost:3000
│   ├── package.json
│   ├── package-lock.json
│   └── 📂 src/
│       ├── main.js / App.vue / style.css
│       ├── api.js              # ตัวเรียก REST API
│       ├── 📂 store/auth.js    # สถานะผู้ใช้ + login/logout/2FA
│       ├── 📂 router/index.js  # guard ตามบทบาท
│       ├── 📂 components/TopBar.vue
│       └── 📂 views/
│           ├── LoginView.vue       # หน้าเข้าสู่ระบบ
│           ├── Setup2FA.vue        # สแกน QR + ตั้งค่า 2FA (ครั้งแรก)
│           ├── Verify2FA.vue       # ยืนยัน 2FA ตอน login
│           ├── QueueBoardView.vue  # กระดานคิว (สิทธิ์ตามบทบาท)
│           └── UsersView.vue       # จัดการผู้ใช้ (admin)
├── 📄 docker-compose.yml       # container db + backend + frontend
├── 📄 .env.example             # ตัวอย่าง environment variables
├── 📄 README.md
├── 📄 CLAUDE.md
└── 📄 LICENSE
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


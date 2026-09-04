# 🏥 Hospital Queue System

> 🌸 ระบบคิวโรงพยาบาลโทนสีชมพู — เรียบง่าย สวยงาม ใช้งานง่าย รันด้วย **Docker** และจัดเก็บข้อมูลด้วย **MariaDB**

---

## ✨ ฟีเจอร์เด่น

| ฟีเจอร์ | รายละเอียด |
|--------|------------|
| ➕ **เพิ่มคิว** | กรอกชื่อผู้ป่วยแล้วกดปุ่มเพิ่มคิว → เข้าสถานะ "🕐 รอตรวจ" |
| 🚶 **สถานะการตรวจ** | กด **เริ่มตรวจ ▶** → ย้ายไป "🩺 กำลังตรวจ" / กด **ตรวจเสร็จ ✓** → ย้ายไป "✅ ตรวจเสร็จ" |
| 📋 **กระดาน 3 คอลัมน์** | แสดงคิวแยกตามสถานะแบบ Real-time พร้อมตัวนับจำนวนแต่ละสถานะ |
| 🗄️ **บันทึกลง MariaDB** | ข้อมูลถูกเก็บในฐานข้อมูล MariaDB ที่แยก container (`db`) — รีเฟรช/ปิดเปิดใหม่ข้อมูลยังอยู่ และอยู่รอดแม้ rebuild container |
| 🐳 **รันด้วย Docker** | แยกเป็น 2 container (`db` + `frontend`) รันด้วยคำสั่งเดียว |
| 🗑️ **ล้างข้อมูล** | ปุ่มล้างคิวที่รอตรวจ หรือล้างข้อมูลทุกสถานะ (มี confirm ก่อนลบ) |
| 🎨 **โทนสีชมพู** | UI สวยงามด้วยเฉดสีชมพูพาสเทล |
| 🛡️ **ความปลอดภัย** | ป้องกัน XSS ด้วยการสร้าง element ผ่าน `textContent` และกัน SQL Injection ด้วย SQL parameter |

---

## 🖼️ หน้าตาโปรเจกต์

```
┌─────────────────────────────────────────────────────┐
│              🌸 ระบบคิวโรงพยาบาล                      │
│         [กรุณากรอกชื่อผู้ป่วย...] ➕ เพิ่มคิว           │
├──────────────┬──────────────┬──────────────────────┤
│ 🕐 รอตรวจ     │ 🩺 กำลังตรวจ   │ ✅ ตรวจเสร็จ           │
│ #1 คนไข้ ก ▶ │ #1 คนไข้ ข ✓  │ #1 คนไข้ ค            │
│ #2 คนไข้ ง ▶ │              │                      │
└──────────────┴──────────────┴──────────────────────┘
```

---

## 🚀 วิธีใช้งาน

### 🐳 รันด้วย Docker (แนะนำ)

1. **สร้างและรันทั้ง 2 container** (`db` = MariaDB, `frontend` = Node.js เสิร์ฟหน้าเว็บ + API):

   ```bash
   docker compose up --build
   ```

   หรือรันแบบ background:

   ```bash
   docker compose up -d --build
   ```

2. **เปิดเบราว์เซอร์** ไปที่ **http://localhost:3000**
3. **พิมพ์ชื่อผู้ป่วย** ในช่องกรอกข้อความ
4. **คลิกปุ่ม "➕ เพิ่มคิว"** หรือกด Enter → คนไข้เข้าสถานะ **รอตรวจ** ทันที
5. เมื่อถึงคิว กด **"เริ่มตรวจ ▶"** → คนไข้ย้ายไปสถานะ **กำลังตรวจ**
6. ตรวจเสร็จแล้วกด **"✓ ตรวจเสร็จ"** → คนไข้ย้ายไปสถานะ **ตรวจเสร็จ**
7. ✅ ข้อมูลทั้งหมดถูกบันทึกลง **MariaDB** แบบ Real-time — ต่อให้รีเฟรชหรือปิดเปิดหน้าเว็บ ข้อมูลยังอยู่ครบ

### 🛑 หยุดการทำงาน

```bash
docker compose down        # หยุด container (ข้อมูลใน volume db_data ยังอยู่)
docker compose down -v     # หยุด + ลบ volume ข้อมูลทั้งหมด
```

### 🔍 ตรวจสอบ container / ดูข้อมูลในฐานข้อมูล

```bash
docker compose ps                                  # ดูสถานะ container ทั้ง 2
docker compose exec db mariadb -u queue_user -pqueue_pass hospital_queue -e "SELECT id, name, status FROM patients ORDER BY seq;"
```

### 💻 รันแบบไม่ใช้ Docker (สำหรับพัฒนา)

ต้องมี MariaDB/MySQL เปิดอยู่แล้ว จากนั้นกำหนดค่า connection ผ่าน environment:

```bash
DB_HOST=127.0.0.1 DB_USER=queue_user DB_PASSWORD=queue_pass DB_NAME=hospital_queue node server.js
```

---

## 🧰 เทคโนโลยีที่ใช้

- ![HTML5](https://img.shields.io/badge/-HTML5-E34F26?style=flat&logo=html5&logoColor=white)
- ![CSS3](https://img.shields.io/badge/-CSS3-1572B6?style=flat&logo=css3&logoColor=white)
- ![JavaScript](https://img.shields.io/badge/-JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black)
- ![Node.js](https://img.shields.io/badge/-Node.js-339933?style=flat&logo=node.js&logoColor=white)
- ![MariaDB](https://img.shields.io/badge/-MariaDB-003545?style=flat&logo=mariadb&logoColor=white)
- ![Docker](https://img.shields.io/badge/-Docker-2496ED?style=flat&logo=docker&logoColor=white)

> 💡 **Vanilla JS + Node.js ล้วน ๆ** — ฝั่งเว็บไม่พึ่งพา framework ใด ๆ ส่วนการเชื่อมต่อ MariaDB ใช้ package `mysql2`

---

## 🏗️ สถาปัตยกรรม (Docker)

```
┌───────────────────────────  docker compose  ───────────────────────────┐
│                                                                        │
│   ┌────────────────────────────┐        ┌────────────────────────────┐ │
│   │   container: frontend       │        │   container: db            │ │
│   │   ─────────────────────     │        │   ─────────────────────     │ │
│   │   Node.js (server.js)       │        │   MariaDB 11.4             │ │
│   │   • เสิร์ฟ index.html        │        │   • ตาราง patients         │ │
│   │   • REST API /api/queue/*   │ ─────▶ │   • ตาราง queue_seq        │ │
│   │                            │  :3306  │   volume: db_data          │ │
│   └────────────────────────────┘        └────────────────────────────┘ │
│   http://localhost:3000                     (ข้อมูลอยู่รอดทุก rebuild)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 📁 โครงสร้างไฟล์

```
📂 hospital-queue-system/
├── 📄 index.html            # 🌸 หน้าเว็บหลัก (กระดานคิว + สถานะการตรวจ)
├── 📄 server.js             # 🚀 เว็บเซิร์ฟเวอร์ + API (อยู่ใน container frontend)
├── 📄 db.js                 # 🗄️ ชั้นเชื่อมต่อ/คิวรีกับ MariaDB (แทนการเขียนไฟล์ .txt)
├── 📄 package.json          # 📦 รายการ dependency (mysql2)
├── 📄 Dockerfile            # 🐳 สร้าง image ของ container frontend
├── 📄 docker-compose.yml    # 🐳 ประกาศ container db + frontend (แยกกัน)
├── 📄 .dockerignore         # 🙈 ไฟล์ที่ไม่ต้องคัดลอกเข้า image
├── 📄 README.md             # 📖 ไฟล์คำอธิบายโปรเจกต์
├── 📄 CLAUDE.md             # 🤖 บันทึกความต้องการจาก Claude
├── 📄 LICENSE               # 📜 สัญญาอนุญาต (MIT)
├── 📄 .gitattributes        # ⚙️ กำหนดค่า Git attributes
└── 📄 .gitignore            # 🙈 ไฟล์ที่ Git ไม่ต้องติดตาม
```

---

## 📜 สัญญาอนุญาต

โครงการนี้อยู่ภายใต้สัญญาอนุญาต **MIT License** — ดูรายละเอียดเพิ่มเติมได้ที่ไฟล์ [LICENSE](./LICENSE)

---

## 👤 ผู้พัฒนา

- **ชื่อ:** Wanut Padee
- **ปี:** 2026

---

> 🌷 **Made with 💖, lots of pink colors, Docker 🐳 and MariaDB 🗄️!**

# 🌸 Dockerfile (multi-stage)
# Stage 1: build Vue 3 frontend (Vite) -> dist
# Stage 2: runtime Express backend + เสิร์ฟ dist
#
# Build:  docker compose up -d --build

# ---------- Stage 1: Build Frontend (Vue 3 + Vite) ----------
FROM node:22-alpine AS frontend-build
WORKDIR /build

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build

# ---------- Stage 2: Runtime (Express backend) ----------
FROM node:22-alpine
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app

# ติดตั้ง dependency ของ backend ก่อน (ใช้ layer cache)
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --omit=dev --no-audit --no-fund

COPY backend/ ./backend/

# นำผลลัพธ์ build ของ Vue เข้าไปไว้ที่ frontend/dist (backend เสิร์ฟจาก path นี้)
COPY --from=frontend-build /build/dist ./frontend/dist

EXPOSE 3000

# db.js มี retry รอ container db พร้อมอยู่แล้ว + docker-compose ใช้ healthcheck
CMD ["node", "backend/src/index.js"]

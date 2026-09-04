# 🌸 Frontend container — Node.js เสิร์ฟหน้าเว็บ (index.html) + REST API
FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# คัดลอก package.json ก่อนเพื่อใช้ Docker layer cache ตอนติดตั้ง dependency
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# คัดลอกโค้ดทั้งหมด (node_modules, .git, *.txt ถูกกันไว้ใน .dockerignore แล้ว)
COPY . .

EXPOSE 3000

# db.js มี retry รอ container db พร้อมอยู่แล้ว + docker-compose ใช้ healthcheck
CMD ["node", "server.js"]

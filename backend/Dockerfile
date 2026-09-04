# 🚀 Backend container — Express.js REST API (แยกจาก frontend)
FROM node:22-alpine

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY src ./src

EXPOSE 3000

# db.js มี retry รอ container db พร้อมอยู่แล้ว + docker-compose ใช้ healthcheck
CMD ["node", "src/index.js"]

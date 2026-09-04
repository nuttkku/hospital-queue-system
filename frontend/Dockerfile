# 🌸 Frontend container — nginx เสิร์ฟ Vue (build แล้ว) + proxy /api -> backend
# Stage 1: build Vue 3 (Vite)
FROM node:22-alpine AS build
WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY . ./
RUN npm run build

# Stage 2: nginx เสิร์ฟ static + reverse proxy API
FROM nginx:alpine

# config proxy /api ไปยัง container backend (ชื่อ service ตาม docker-compose)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# วางผล build ไว้ที่ root ของ nginx
COPY --from=build /build/dist /usr/share/nginx/html

EXPOSE 80

# nginx รันเป็น process แรก (PID 1) เพื่อรับ signal ปกติ
CMD ["nginx", "-g", "daemon off;"]

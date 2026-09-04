# 🔒 Proxy container — nginx ทำ Reverse Proxy + HTTPS (self-signed cert)
# เป็นทางเข้าหลักของระบบ: https://localhost
#   /api/*  -> backend:3000
#   ที่เหลือ -> frontend:80 (Vue static)
FROM nginx:alpine

# ใช้ openssl สร้าง self-signed certificate ตอน build (อยู่คงที่ใน image)
RUN apk add --no-cache openssl && rm -rf /var/cache/apk/*

COPY nginx.conf /etc/nginx/conf.d/default.conf

# สร้าง self-signed cert (localhost + 127.0.0.1) อายุ 10 ปี
# ถ้าอยากได้ cert ใหม่ ให้ลบ image แล้ว build ใหม่ หรือ mount ไฟล์ cert ทับที่ path นี้
RUN mkdir -p /etc/nginx/ssl \
    && openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
        -keyout /etc/nginx/ssl/privkey.pem \
        -out /etc/nginx/ssl/fullchain.pem \
        -subj "/C=TH/ST=Bangkok/L=Bangkok/O=HospitalQueue/CN=localhost" \
        -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

EXPOSE 443

CMD ["nginx", "-g", "daemon off;"]

# Base image: Node.js 22 trên Alpine Linux (nhẹ, bảo mật)
FROM node:22-alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Cài đặt các công cụ hệ thống cần thiết: python3 (cho yt-dlp), ffmpeg (xử lý DASH remux), curl
RUN apk add --no-cache \
    python3 \
    ffmpeg \
    curl \
    ca-certificates

# Tải yt-dlp binary mới nhất trực tiếp vào /usr/local/bin
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Sao chép file định nghĩa dependencies
COPY package*.json ./

# Cài đặt các package npm
RUN npm install --omit=dev

# Sao chép toàn bộ mã nguồn vào container
COPY . .

# Đặt biến môi trường mặc định
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    YTDLP_PATH=/usr/local/bin/yt-dlp

# Mở cổng 3000
EXPOSE 3000

# Kiểm tra tình trạng hoạt động (Healthcheck)
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Khởi động ứng dụng
CMD ["node", "src/server.js"]

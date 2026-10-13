# Cobalt Stream - Công Cụ Tải Video Đa Nền Tảng (TikTok, YouTube, Bilibili)

Ứng dụng web tải video và âm thanh tối giản, không quảng cáo, lấy cảm hứng từ [Cobalt](https://cobalt.tools/). Ứng dụng áp dụng kiến trúc **Diskless Streaming Proxy** (truyền luồng trực tiếp từ nguồn về máy người dùng không lưu file tạm trên đĩa cứng server).

---

## ✨ Tính Năng Nổi Bật

* **Giao diện Omnibox tối giản (Cobalt UI):**
  * Tự động nhận diện nền tảng khi dán link.
  * Hỗ trợ nút dán nhanh từ clipboard và chế độ Sáng / Tối (Dark / Light mode).
  * Hiển thị thẻ xem trước (Thumbnail, Tiêu đề, Tác giả, Thời lượng) và danh sách định dạng tải rõ ràng.
* **TikTok Chuyên Sâu:**
  * Tải video **không logo (No Watermark)** chất lượng cao nhất.
  * Tách riêng âm thanh gốc (MP3).
  * Hỗ trợ xem và tải toàn bộ **Album ảnh (Slide photo)** đóng gói thành file ZIP.
* **YouTube Trực Quan:**
  * Trích xuất các độ phân giải từ 360p, 720p tới 1080p, 1440p, 4K.
  * Tự động gộp luồng DASH (Video + Audio) **on-the-fly qua FFmpeg** mà không lưu file đĩa.
  * Hỗ trợ định dạng Audio riêng (M4A / MP3).
  * Hỗ trợ cấu hình `cookies.txt` để vượt cơ chế kiểm tra bot của YouTube trên máy chủ đám mây.
* **Bilibili Tối Ưu:**
  * Hỗ trợ cả link Bilibili quốc tế (`bilibili.tv`) và nội địa (`bilibili.com`).
  * Tự động inject header `Referer` chống lỗi 403 Forbidden từ CDN Bilibili.
* **Bảo Mật & Quản Lý Tài Nguyên:**
  * Chống tấn công SSRF với domain whitelist nghiêm ngặt và chặn IP mạng nội bộ.
  * Giới hạn thời lượng video tối đa (mặc định 30 phút) để bảo vệ CPU.
  * Tự động giải phóng tiến trình FFmpeg / child process khi client ngắt kết nối (`req.on('close')`), chống rò rỉ tiến trình zombie.

---

## 🛠️ Yêu Cầu & Công Nghệ

* **Runtime:** Node.js (v22 LTS trở lên).
* **Media Core:** `yt-dlp` (tự động quản lý), `ffmpeg-static` (hoặc FFmpeg hệ thống).
* **Frontend:** HTML5, CSS3 hiện đại, Vanilla JavaScript (Zero framework bloat).
* **Container:** Hỗ trợ Docker và Docker Compose đầy đủ.

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### Cách 1: Chạy bằng Docker (Khuyên dùng)

Dự án đã được cấu hình trọn gói với Dockerfile trên nền Alpine Linux nhẹ và bảo mật.

1. Khởi động với Docker Compose:
```bash
docker compose up --build -d
```
2. Truy cập ứng dụng tại: `http://localhost:3000`

> **Lưu ý về YouTube:** Để tránh bị YouTube chặn bot trên VPS/Server, bạn có thể xuất file `cookies.txt` từ trình duyệt và đặt cùng thư mục với `docker-compose.yml` (đã được cấu hình tự động mount vào container).

---

### Cách 2: Chạy trực tiếp trên máy chủ / Localhost

1. Cài đặt các thư viện:
```bash
npm install
```

2. Tải và chuẩn bị binary `yt-dlp`:
```bash
npm run setup:bin
```

3. Khởi động server:
```bash
npm start
```
Hoặc chế độ phát triển (auto-reload):
```bash
npm run dev
```

4. Mở trình duyệt tại `http://localhost:3000`.

---

## 🧪 Kiểm Thử (Testing)

Dự án đi kèm bộ unit test và integration test hoàn chỉnh sử dụng `node:test` (tích hợp sẵn trong Node.js):

```bash
npm test
```

Bộ test bao gồm:
* Kiểm tra xác thực URL & chống tấn công SSRF (`test/validator.test.js`).
* Kiểm tra định dạng thời lượng, kích thước file và Content-Disposition an toàn (`test/formatHelper.test.js`).
* Kiểm tra các endpoint API và phục vụ tài nguyên tĩnh (`test/routes.test.js`).
* Kiểm tra cơ chế Diskless Pipe và hủy request khi client ngắt kết nối (`test/streamService.test.js`).
* Kiểm tra bộ điều phối Extractor (`test/extractors.test.js`).

---

## 📡 Tài Liệu API

### 1. `GET /api/info?url=<media_url>`
Trích xuất thông tin media và danh sách định dạng khả dụng.

**Response mẫu:**
```json
{
  "status": "success",
  "platform": "youtube",
  "title": "Tên video mẫu",
  "author": "Tên kênh",
  "thumbnail": "https://...",
  "duration": 240,
  "durationFormatted": "04:00",
  "formats": [
    {
      "id": "1080p",
      "label": "1080p HD (MP4)",
      "type": "video",
      "ext": "mp4",
      "needMux": true,
      "filesizeFormatted": "45.2 MB"
    },
    {
      "id": "audio_best",
      "label": "Âm thanh (M4A / MP3 ~128kbps)",
      "type": "audio",
      "ext": "m4a",
      "needMux": false
    }
  ],
  "isPhotoAlbum": false,
  "photos": []
}
```

### 2. `GET /api/download?url=<media_url>&format_id=<id>&mode=<video|audio|photos>`
Truyền luồng (stream pipe) file media trực tiếp về máy người dùng với header `Content-Disposition: attachment; filename="..."`.

* `mode=photos`: Tải toàn bộ album ảnh dưới dạng file `.zip` nén trực tiếp.
* Nếu format cần mux (`needMux: true`): Tự động remux on-the-fly luồng video và audio qua FFmpeg.

### 3. `GET /api/health`
Kiểm tra tình trạng hoạt động (Healthcheck cho Docker).

---

## 🔒 Biến Môi Trường (.env)

| Tên biến | Mặc định | Mô tả |
| :--- | :--- | :--- |
| `PORT` | `3000` | Cổng HTTP lắng nghe |
| `HOST` | `0.0.0.0` | Địa chỉ IP bind |
| `MAX_DURATION` | `1800` | Thời lượng video tối đa cho phép (giây) |
| `COOKIES_PATH` | `./cookies.txt` | Đường dẫn file cookies cho yt-dlp |
| `REQUEST_TIMEOUT_MS` | `30000` | Thời gian timeout khi bóc tách thông tin |

---

## 📄 Bản Quyền
Mã nguồn phát hành theo giấy phép MIT.

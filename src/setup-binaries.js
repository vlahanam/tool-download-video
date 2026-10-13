import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { config } from './config.js';

/**
 * Tự động tải binary yt-dlp phù hợp với hệ điều hành nếu chưa có
 */
export async function setupBinaries() {
  if (!fs.existsSync(config.binDir)) {
    fs.mkdirSync(config.binDir, { recursive: true });
  }

  const binaryPath = config.ytdlpPath;
  if (fs.existsSync(binaryPath)) {
    console.log(`[setup-binaries] yt-dlp đã sẵn sàng tại: ${binaryPath}`);
    return binaryPath;
  }

  // Kiểm tra xem yt-dlp đã có sẵn trên PATH của hệ thống chưa
  const checkSystem = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['yt-dlp'], { encoding: 'utf-8' });
  if (checkSystem.status === 0 && checkSystem.stdout.trim()) {
    const sysPath = checkSystem.stdout.trim().split('\n')[0].trim();
    console.log(`[setup-binaries] Phát hiện yt-dlp hệ thống tại: ${sysPath}`);
    return sysPath;
  }

  console.log(`[setup-binaries] Chưa phát hiện yt-dlp. Đang chuẩn bị tải về...`);

  // Xác định file download theo OS
  let downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
  if (process.platform === 'win32') {
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
  } else if (process.platform === 'darwin') {
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos';
  } else if (process.platform === 'linux') {
    downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';
  }

  try {
    console.log(`[setup-binaries] Đang tải yt-dlp từ ${downloadUrl}...`);
    const res = await fetch(downloadUrl, { redirect: 'follow' });
    if (!res.ok) {
      throw new Error(`Tải thất bại với mã trạng thái: ${res.status}`);
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(binaryPath, buffer);
    if (process.platform !== 'win32') {
      fs.chmodSync(binaryPath, 0o755);
    }
    console.log(`[setup-binaries] Đã tải yt-dlp thành công vào ${binaryPath}`);
    return binaryPath;
  } catch (err) {
    console.warn(`[setup-binaries] Cảnh báo: Không thể tải trực tiếp yt-dlp (${err.message}). Có thể ứng dụng đang chạy trong môi trường offline/container đã cài sẵn.`);
    return null;
  }
}

// Chạy trực tiếp nếu script được gọi bằng node
if (process.argv[1] && process.argv[1].endsWith('setup-binaries.js')) {
  setupBinaries().catch(err => {
    console.error('[setup-binaries] Lỗi thiết lập:', err);
  });
}

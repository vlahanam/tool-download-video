import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Tải file .env bằng tính năng native của Node 22 nếu có
const envPath = path.join(rootDir, '.env');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    console.warn('[config] Không thể tải .env:', err.message);
  }
}

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',
  rootDir,
  binDir: path.join(rootDir, 'bin'),
  ytdlpPath: process.env.YTDLP_PATH || path.join(rootDir, 'bin', process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'),
  cookiesPath: process.env.COOKIES_PATH || path.join(rootDir, 'cookies.txt'),
  
  // Security & limits
  maxDurationSeconds: parseInt(process.env.MAX_DURATION || '1800', 10), // Mặc định 30 phút
  requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10), // 30s
  streamTimeoutMs: parseInt(process.env.STREAM_TIMEOUT_MS || '1800000', 10), // 30m
  
  // Whitelist domains (TikTok, YouTube, Bilibili)
  allowedDomains: [
    'tiktok.com',
    'vm.tiktok.com',
    'vt.tiktok.com',
    'm.tiktok.com',
    'www.tiktok.com',
    'douyin.com',
    'v.douyin.com',
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'bilibili.com',
    'www.bilibili.com',
    'm.bilibili.com',
    'bilibili.tv',
    'www.bilibili.tv',
    'b23.tv'
  ]
};

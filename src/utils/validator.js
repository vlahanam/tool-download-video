import { URL } from 'node:url';
import { config } from '../config.js';

const PRIVATE_IP_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^169\.254\./, // AWS/GCP metadata
  /^::1$/,
  /^fc00:/i,
  /^fe80:/i
];

/**
 * Xác thực và phân loại URL để chống SSRF và đảm bảo thuộc whitelist domain
 * @param {string} rawUrl 
 * @returns {{ valid: boolean, url?: string, platform?: 'tiktok'|'youtube'|'bilibili', error?: string }}
 */
export function validateMediaUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL không được để trống.' };
  }

  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Định dạng URL không hợp lệ.' };
  }

  // Chỉ chấp nhận HTTP/HTTPS
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Chỉ hỗ trợ giao thức HTTP/HTTPS.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Chống SSRF: kiểm tra private/internal IP
  for (const pattern of PRIVATE_IP_PATTERNS) {
    if (pattern.test(hostname)) {
      return { valid: false, error: 'Truy cập vào mạng nội bộ bị từ chối (SSRF Protection).' };
    }
  }

  // Nhận diện platform theo domain
  let matchedPlatform = null;

  const isTikTok = config.allowedDomains.some(d => 
    (d.includes('tiktok') || d.includes('douyin')) && 
    (hostname === d || hostname.endsWith(`.${d}`))
  );

  const isYouTube = config.allowedDomains.some(d => 
    (d.includes('youtube') || d.includes('youtu.be')) && 
    (hostname === d || hostname.endsWith(`.${d}`))
  );

  const isBilibili = config.allowedDomains.some(d => 
    (d.includes('bilibili') || d.includes('b23.tv')) && 
    (hostname === d || hostname.endsWith(`.${d}`))
  );

  if (isTikTok) {
    matchedPlatform = 'tiktok';
  } else if (isYouTube) {
    matchedPlatform = 'youtube';
  } else if (isBilibili) {
    matchedPlatform = 'bilibili';
  } else {
    return {
      valid: false,
      error: 'Nền tảng không được hỗ trợ. Hiện chỉ hỗ trợ TikTok, YouTube, và Bilibili.'
    };
  }

  return {
    valid: true,
    url: parsed.toString(),
    platform: matchedPlatform
  };
}

/**
 * Kiểm tra thời lượng video có vượt quá ngưỡng cho phép không
 * @param {number} durationSeconds 
 * @returns {boolean}
 */
export function isDurationAllowed(durationSeconds) {
  if (!durationSeconds || typeof durationSeconds !== 'number') {
    return true; // Nếu không xác định được duration thì vẫn cho phép xử lý tiếp
  }
  return durationSeconds <= config.maxDurationSeconds;
}

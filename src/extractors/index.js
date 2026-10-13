import { validateMediaUrl } from '../utils/validator.js';
import { tiktokExtractor } from './tiktok.js';
import { youtubeExtractor } from './youtube.js';
import { bilibiliExtractor } from './bilibili.js';

/**
 * Điều phối bóc tách thông tin dựa theo nền tảng
 * @param {string} rawUrl 
 * @returns {Promise<object>}
 */
export async function extractMediaInfo(rawUrl) {
  const validation = validateMediaUrl(rawUrl);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  const { url, platform } = validation;

  switch (platform) {
    case 'tiktok':
      return await tiktokExtractor.extract(url);
    case 'youtube':
      return await youtubeExtractor.extract(url);
    case 'bilibili':
      return await bilibiliExtractor.extract(url);
    default:
      throw new Error(`Chưa có bộ xử lý cho nền tảng: ${platform}`);
  }
}

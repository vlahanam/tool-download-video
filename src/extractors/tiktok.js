import { ytdlpService } from '../services/ytdlpService.js';
import { formatDuration } from '../utils/formatHelper.js';

export const tiktokExtractor = {
  platform: 'tiktok',

  /**
   * Trích xuất thông tin TikTok (Ưu tiên TikWM API, fallback yt-dlp)
   * @param {string} url 
   * @returns {Promise<object>}
   */
  async extract(url) {
    // 1. Thử qua TikWM API công khai (nhanh, bóc được cả slide ảnh và link không watermark)
    try {
      const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.code === 0 && data.data) {
          const item = data.data;
          const isPhotoAlbum = Array.isArray(item.images) && item.images.length > 0;

          const formats = [];
          if (item.play) {
            formats.push({
              id: 'no_watermark',
              label: 'Video HD (Không Watermark)',
              type: 'video',
              ext: 'mp4',
              url: item.play,
              needMux: false
            });
          }
          if (item.wmplay) {
            formats.push({
              id: 'watermark',
              label: 'Video có Logo gốc',
              type: 'video',
              ext: 'mp4',
              url: item.wmplay,
              needMux: false
            });
          }
          if (item.music) {
            formats.push({
              id: 'audio',
              label: 'Âm thanh gốc (MP3)',
              type: 'audio',
              ext: 'mp3',
              url: item.music,
              needMux: false
            });
          }

          return {
            status: 'success',
            platform: 'tiktok',
            title: item.title || 'TikTok Video',
            author: item.author?.nickname || item.author?.unique_id || 'TikTok Creator',
            thumbnail: item.cover || (isPhotoAlbum ? item.images[0] : ''),
            duration: item.duration || 0,
            durationFormatted: formatDuration(item.duration || 0),
            formats,
            isPhotoAlbum,
            photos: isPhotoAlbum ? item.images : []
          };
        }
      }
    } catch (apiErr) {
      console.warn(`[tiktokExtractor] TikWM API thất bại (${apiErr.message}), chuyển sang fallback yt-dlp...`);
    }

    // 2. Fallback sang yt-dlp nếu direct API thất bại
    const info = await ytdlpService.getMetadata(url);
    const formats = [];

    // Lọc format chất lượng tốt nhất
    if (info.url) {
      formats.push({
        id: 'direct_best',
        label: 'Video gốc (MP4)',
        type: 'video',
        ext: info.ext || 'mp4',
        url: info.url,
        needMux: false
      });
    } else if (info.formats && info.formats.length > 0) {
      const bestVideo = info.formats
        .filter(f => f.vcodec !== 'none' && f.acodec !== 'none')
        .pop() || info.formats[info.formats.length - 1];

      formats.push({
        id: bestVideo.format_id || 'best',
        label: `Video ${bestVideo.resolution || 'HD'} (MP4)`,
        type: 'video',
        ext: 'mp4',
        url: bestVideo.url,
        needMux: false
      });
    }

    return {
      status: 'success',
      platform: 'tiktok',
      title: info.title || 'TikTok Media',
      author: info.uploader || 'TikTok User',
      thumbnail: info.thumbnail || '',
      duration: info.duration || 0,
      durationFormatted: formatDuration(info.duration || 0),
      formats,
      isPhotoAlbum: false,
      photos: []
    };
  }
};

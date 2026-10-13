import { ytdlpService } from '../services/ytdlpService.js';
import { isDurationAllowed } from '../utils/validator.js';
import { formatDuration, formatFileSize } from '../utils/formatHelper.js';
import { config } from '../config.js';

export const bilibiliExtractor = {
  platform: 'bilibili',

  /**
   * Trích xuất thông tin Bilibili
   * @param {string} url 
   * @returns {Promise<object>}
   */
  async extract(url) {
    const info = await ytdlpService.getMetadata(url, {
      extraArgs: ['--add-header', 'Referer:https://www.bilibili.com/']
    });

    if (info.duration && !isDurationAllowed(info.duration)) {
      throw new Error(`Video dài ${formatDuration(info.duration)}, vượt quá giới hạn tối đa cho phép (${Math.round(config.maxDurationSeconds / 60)} phút).`);
    }

    const rawFormats = info.formats || [];
    const formats = [];

    // Tìm luồng audio Bilibili tốt nhất
    const bestAudio = rawFormats
      .filter(f => f.acodec !== 'none' && f.vcodec === 'none')
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

    const resolutionMap = new Map();

    for (const f of rawFormats) {
      if (f.vcodec === 'none') continue;
      const height = f.height;
      if (!height) continue;

      const isProgressive = f.acodec !== 'none';
      const existing = resolutionMap.get(height);

      if (!existing || (isProgressive && existing.needMux) || (f.tbr || 0) > (existing.tbr || 0)) {
        resolutionMap.set(height, {
          id: f.format_id,
          height,
          label: `${height}p ${height >= 1080 ? 'HD' : ''} (MP4)`,
          type: 'video',
          ext: 'mp4',
          url: f.url,
          needMux: !isProgressive,
          audioUrl: !isProgressive && bestAudio ? bestAudio.url : null,
          audioCodec: bestAudio ? bestAudio.acodec : null,
          headers: {
            'Referer': 'https://www.bilibili.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          filesize: f.filesize || f.filesize_approx,
          filesizeFormatted: formatFileSize(f.filesize || f.filesize_approx)
        });
      }
    }

    const sortedResolutions = Array.from(resolutionMap.values())
      .sort((a, b) => b.height - a.height);

    formats.push(...sortedResolutions);

    if (bestAudio) {
      formats.push({
        id: 'audio_best',
        format_id: bestAudio.format_id,
        label: `Âm thanh Bilibili (${bestAudio.ext || 'm4a'})`,
        type: 'audio',
        ext: bestAudio.ext || 'm4a',
        url: bestAudio.url,
        needMux: false,
        headers: {
          'Referer': 'https://www.bilibili.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        filesize: bestAudio.filesize || bestAudio.filesize_approx,
        filesizeFormatted: formatFileSize(bestAudio.filesize || bestAudio.filesize_approx)
      });
    }

    return {
      status: 'success',
      platform: 'bilibili',
      title: info.title || 'Bilibili Video',
      author: info.uploader || 'Bilibili Creator',
      thumbnail: info.thumbnail || '',
      duration: info.duration || 0,
      durationFormatted: formatDuration(info.duration || 0),
      formats,
      isPhotoAlbum: false,
      photos: []
    };
  }
};

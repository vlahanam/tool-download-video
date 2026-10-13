import { ytdlpService } from '../services/ytdlpService.js';
import { isDurationAllowed } from '../utils/validator.js';
import { formatDuration, formatFileSize } from '../utils/formatHelper.js';
import { config } from '../config.js';

export const youtubeExtractor = {
  platform: 'youtube',

  /**
   * Trích xuất thông tin YouTube
   * @param {string} url 
   * @returns {Promise<object>}
   */
  async extract(url) {
    const info = await ytdlpService.getMetadata(url);

    // Kiểm tra giới hạn thời lượng
    if (info.duration && !isDurationAllowed(info.duration)) {
      throw new Error(`Video dài ${formatDuration(info.duration)}, vượt quá giới hạn tối đa cho phép (${Math.round(config.maxDurationSeconds / 60)} phút).`);
    }

    const rawFormats = info.formats || [];
    const formats = [];

    // Tìm luồng audio: ưu tiên AAC (m4a) để tương thích tối đa với MP4, fallback sang Opus
    const aacAudio = rawFormats
      .filter(f => f.vcodec === 'none' && (f.acodec || '').toLowerCase().includes('mp4a'))
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

    const bestAudio = aacAudio || rawFormats
      .filter(f => f.acodec !== 'none' && f.vcodec === 'none')
      .sort((a, b) => (b.abr || 0) - (a.abr || 0))[0];

    // Nhóm video theo độ phân giải chuẩn, hỗ trợ từ 144p đến 4K
    const standardHeights = [144, 240, 360, 480, 720, 1080, 1440, 2160];
    const resolutionMap = new Map();

    for (const f of rawFormats) {
      if (f.vcodec === 'none') continue;
      const height = f.height;
      if (!height) continue;

      // Tìm độ phân giải chuẩn gần nhất
      const matchedHeight = standardHeights.find(h => Math.abs(h - height) <= 30) || height;
      
      const isProgressive = f.acodec !== 'none';
      const isH264 = (f.vcodec || '').toLowerCase().startsWith('avc1') || (f.vcodec || '').toLowerCase().startsWith('h264');
      const existing = resolutionMap.get(matchedHeight);

      let shouldReplace = false;
      if (!existing) {
        shouldReplace = true;
      } else if (isProgressive && existing.needMux) {
        shouldReplace = true;
      } else if (!existing.isProgressive) {
        const existingIsH264 = (existing.vcodec || '').toLowerCase().startsWith('avc1') || (existing.vcodec || '').toLowerCase().startsWith('h264');
        if (isH264 && !existingIsH264) {
          shouldReplace = true; // Ưu tiên H.264 cho tương thích Windows Media Player và mobile
        } else if (isH264 === existingIsH264) {
          if ((f.tbr || 0) > (existing.tbr || 0)) {
            shouldReplace = true;
          }
        }
      }

      if (shouldReplace) {
        resolutionMap.set(matchedHeight, {
          id: f.format_id,
          height: matchedHeight,
          vcodec: f.vcodec,
          tbr: f.tbr || 0,
          isProgressive,
          label: `${matchedHeight}p ${matchedHeight >= 1080 ? 'HD' : ''} (MP4)`,
          type: 'video',
          ext: 'mp4',
          url: f.url,
          needMux: !isProgressive,
          audioUrl: !isProgressive && bestAudio ? bestAudio.url : null,
          audioCodec: bestAudio ? bestAudio.acodec : null,
          filesize: f.filesize || f.filesize_approx,
          filesizeFormatted: formatFileSize(f.filesize || f.filesize_approx)
        });
      }
    }

    // Sắp xếp video theo độ phân giải từ cao xuống thấp
    const sortedResolutions = Array.from(resolutionMap.values())
      .sort((a, b) => b.height - a.height);

    formats.push(...sortedResolutions);

    // Thêm định dạng Audio riêng
    if (bestAudio) {
      formats.push({
        id: 'audio_best',
        format_id: bestAudio.format_id,
        label: `Âm thanh (M4A / MP3 ~${Math.round(bestAudio.abr || 128)}kbps)`,
        type: 'audio',
        ext: 'm4a',
        url: bestAudio.url,
        needMux: false,
        filesize: bestAudio.filesize || bestAudio.filesize_approx,
        filesizeFormatted: formatFileSize(bestAudio.filesize || bestAudio.filesize_approx)
      });
    }

    return {
      status: 'success',
      platform: 'youtube',
      title: info.title || 'YouTube Video',
      author: info.uploader || info.channel || 'YouTube Creator',
      thumbnail: info.thumbnail || '',
      duration: info.duration || 0,
      durationFormatted: formatDuration(info.duration || 0),
      formats,
      isPhotoAlbum: false,
      photos: []
    };
  }
};

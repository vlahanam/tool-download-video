import { ytdlpService } from './ytdlpService.js';
import { getSafeContentDisposition } from '../utils/formatHelper.js';

export const TARGET_LANGUAGES = [
  { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳', aliases: ['vi', 'vie', 'vi-vn', 'vi_vn', 'vietnamese'] },
  { code: 'en', label: 'Tiếng Anh', flag: '🇬🇧', aliases: ['en', 'eng', 'en-us', 'en-gb', 'en-ca', 'en_us', 'en_gb', 'english', 'en-orig'] },
  { code: 'zh', label: 'Tiếng Trung', flag: '🇨🇳', aliases: ['zh', 'zho', 'chi', 'zh-hans', 'zh-hant', 'zh-cn', 'zh-tw', 'zh-hk', 'zh-sg', 'zh_cn', 'zh_tw', 'chinese', 'ai-zh'] }
];

/**
 * Khớp mã ngôn ngữ của track với 1 trong 3 ngôn ngữ đích (vi, en, zh)
 * @param {string} trackKey 
 * @returns {'vi'|'en'|'zh'|null}
 */
export function matchTargetLanguage(trackKey) {
  if (!trackKey || typeof trackKey !== 'string') return null;
  const lower = trackKey.toLowerCase().trim();

  // Kiểm tra Tiếng Việt
  if (lower === 'vi' || lower.startsWith('vi-') || lower.startsWith('vi_') || lower === 'vie' || lower.includes('vietnamese')) {
    return 'vi';
  }

  // Kiểm tra Tiếng Anh
  if (lower === 'en' || lower.startsWith('en-') || lower.startsWith('en_') || lower === 'eng' || lower.includes('english')) {
    return 'en';
  }

  // Kiểm tra Tiếng Trung
  if (lower === 'zh' || lower.startsWith('zh-') || lower.startsWith('zh_') || lower === 'chi' || lower === 'zho' || lower.includes('chinese') || lower.startsWith('ai-zh')) {
    return 'zh';
  }

  return null;
}

/**
 * Kiểm tra xem track có phải dạng dịch tự động từ ngôn ngữ khác (ví dụ: vi-en, zh-Hans-en)
 * @param {string} trackKey 
 * @returns {boolean}
 */
export function isTranslatedTrack(trackKey) {
  if (!trackKey) return false;
  const lower = trackKey.toLowerCase();
  // Các mẫu như vi-en, vi-de, zh-Hans-en, en-de
  return /^[a-z]{2}(?:-[a-z]+)?-[a-z]{2}$/i.test(lower) && !lower.includes('-orig');
}

/**
 * Giải mã các ký tự thực thể HTML
 * @param {string} text 
 * @returns {string}
 */
export function unescapeHtml(text) {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Chuyển đổi mili-giây sang định dạng thời gian chuẩn SRT (HH:MM:SS,mmm)
 * @param {number} totalMs 
 * @returns {string}
 */
export function msToSrtTime(totalMs) {
  const ms = Math.max(0, Math.round(Number(totalMs) || 0));
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const remainderMs = ms % 1000;

  const hh = String(hours).padStart(2, '0');
  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  const mmm = String(remainderMs).padStart(3, '0');

  return `${hh}:${mm}:${ss},${mmm}`;
}

/**
 * Phân tích chuỗi thời gian SRT hoặc WebVTT (HH:MM:SS.mmm hoặc MM:SS.mmm) sang mili-giây
 * @param {string} timeStr 
 * @returns {number}
 */
export function parseTimeToMs(timeStr) {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().replace(',', '.');
  const parts = cleaned.split(':');
  let totalSeconds = 0;

  if (parts.length === 3) {
    totalSeconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    totalSeconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  } else {
    totalSeconds = parseFloat(parts[0]) || 0;
  }

  return Math.round(totalSeconds * 1000);
}

/**
 * Phân tích nội dung phụ đề thô thành danh sách các cue { startMs, endMs, text }
 * Hỗ trợ WebVTT, SRT, Bilibili BCC (JSON), YouTube JSON3, và XML/SRV1/TTML
 * @param {string|object} rawContent 
 * @param {string} [formatHint] 
 * @returns {Array<{ startMs: number, endMs: number, text: string }>}
 */
export function parseSubtitlesToCues(rawContent, formatHint = '') {
  if (!rawContent) return [];

  // 1. Nếu là Object hoặc chuỗi JSON
  let jsonParsed = null;
  if (typeof rawContent === 'object' && rawContent !== null) {
    jsonParsed = rawContent;
  } else if (typeof rawContent === 'string' && (rawContent.trim().startsWith('{') || rawContent.trim().startsWith('['))) {
    try {
      jsonParsed = JSON.parse(rawContent);
    } catch {}
  }

  if (jsonParsed) {
    // 1.1 Bilibili BCC Format: { body: [ { from, to, content } ] }
    if (Array.isArray(jsonParsed.body)) {
      return jsonParsed.body
        .filter(item => item && (item.content || '').trim())
        .map(item => ({
          startMs: Math.round((Number(item.from) || 0) * 1000),
          endMs: Math.round((Number(item.to) || (Number(item.from) || 0) + 2) * 1000),
          text: unescapeHtml(item.content).replace(/<\/?[^>]+(>|$)/g, '').trim()
        }));
    }

    // 1.2 YouTube JSON3 Format: { events: [ { tStartMs, dDurationMs, segs: [ { utf8 } ] } ] }
    if (Array.isArray(jsonParsed.events)) {
      const cues = [];
      for (const ev of jsonParsed.events) {
        if (!ev.segs || !Array.isArray(ev.segs) || ev.segs.length === 0) continue;
        const text = ev.segs.map(s => s.utf8 || '').join('').trim();
        if (!text || text === '\n') continue;

        const startMs = ev.tStartMs || 0;
        const durMs = ev.dDurationMs || 2000;
        const endMs = startMs + durMs;

        cues.push({
          startMs,
          endMs,
          text: unescapeHtml(text).replace(/<\/?[^>]+(>|$)/g, '').trim()
        });
      }
      return cues;
    }
  }

  const textContent = typeof rawContent === 'string' ? rawContent : '';

  // 2. Định dạng XML / SRV1 / TTML: <text start="1.2" dur="2.1">...</text>
  if (textContent.includes('<transcript') || textContent.includes('<text start=') || textContent.includes('<tt') || textContent.includes('<p begin=')) {
    const cues = [];
    // Hỗ trợ thẻ <text start="..." dur="...">
    const srv1Regex = /<text\s+start="([0-9\.]+)"(?:\s+dur="([0-9\.]+)")?[^>]*>(.*?)<\/text>/gi;
    let match;
    while ((match = srv1Regex.exec(textContent)) !== null) {
      const startMs = Math.round(parseFloat(match[1]) * 1000);
      const durMs = match[2] ? Math.round(parseFloat(match[2]) * 1000) : 2000;
      const endMs = startMs + durMs;
      const rawText = unescapeHtml(match[3]).replace(/<\/?[^>]+(>|$)/g, '').trim();
      if (rawText) {
        cues.push({ startMs, endMs, text: rawText });
      }
    }

    if (cues.length > 0) return cues;

    // Hỗ trợ thẻ TTML <p begin="..." end="...">
    const ttmlRegex = /<p\s+begin="([^"]+)"\s+end="([^"]+)"[^>]*>(.*?)<\/p>/gi;
    while ((match = ttmlRegex.exec(textContent)) !== null) {
      const startMs = parseTimeToMs(match[1]);
      const endMs = parseTimeToMs(match[2]);
      const rawText = unescapeHtml(match[3]).replace(/<\/?[^>]+(>|$)/g, '').trim();
      if (rawText) {
        cues.push({ startMs, endMs, text: rawText });
      }
    }

    if (cues.length > 0) return cues;
  }

  // 3. Định dạng WebVTT hoặc SRT
  const cues = [];
  const timeRegex = /((?:\d{1,2}:)?\d{2}:\d{2}[\.,]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[\.,]\d{3})/;
  const blocks = textContent.trim().split(/\r?\n\r?\n/);

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    let timeIndex = -1;
    let match = null;

    for (let i = 0; i < lines.length; i++) {
      match = lines[i].match(timeRegex);
      if (match) {
        timeIndex = i;
        break;
      }
    }

    if (timeIndex === -1 || !match) continue;

    const startMs = parseTimeToMs(match[1]);
    const endMs = parseTimeToMs(match[2]);
    const cueText = lines
      .slice(timeIndex + 1)
      .join('\n')
      .replace(/<\/?[^>]+(>|$)/g, '') // Bỏ thẻ inline styling
      .trim();

    if (cueText) {
      cues.push({ startMs, endMs, text: unescapeHtml(cueText) });
    }
  }

  return cues;
}

/**
 * Chuyển đổi mảng cue thành nội dung định dạng SRT chuẩn SubRip
 * @param {Array<{ startMs: number, endMs: number, text: string }>} cues 
 * @returns {string}
 */
export function cuesToSrt(cues) {
  if (!cues || cues.length === 0) return '';
  return cues
    .filter(c => c.text && c.text.trim())
    .map((c, idx) => {
      const startTime = msToSrtTime(c.startMs);
      const endTime = msToSrtTime(Math.max(c.endMs, c.startMs + 500));
      const text = c.text.trim();
      return `${idx + 1}\n${startTime} --> ${endTime}\n${text}\n`;
    })
    .join('\n');
}

/**
 * Chuyển đổi mảng cue thành nội dung văn bản thuần TXT
 * Tự động lọc trùng lặp liên tiếp do live streaming caption
 * @param {Array<{ startMs: number, endMs: number, text: string }>} cues 
 * @returns {string}
 */
export function cuesToTxt(cues) {
  if (!cues || cues.length === 0) return '';
  const lines = [];
  let prevText = '';

  for (const c of cues) {
    const text = (c.text || '').trim();
    if (!text || text === prevText) continue;
    lines.push(text);
    prevText = text;
  }

  return lines.join('\n');
}

/**
 * Tìm track phụ đề phù hợp nhất từ danh sách formats của yt-dlp
 * @param {object} info 
 * @param {'vi'|'en'|'zh'} targetLang 
 * @returns {object|null}
 */
export function findBestSubtitleTrack(info, targetLang) {
  const subtitles = info.subtitles || {};
  const autoCaptions = info.automatic_captions || {};

  const candidates = [];

  // 1. Quét creator manual subtitles (độ ưu tiên cao nhất: priority 100)
  for (const [key, formats] of Object.entries(subtitles)) {
    if (matchTargetLanguage(key) === targetLang) {
      candidates.push({
        trackKey: key,
        formats: formats || [],
        isAuto: false,
        priority: 100
      });
    }
  }

  // 2. Quét auto captions (tiếng gốc của video: priority 80, dịch tự động: priority 50)
  for (const [key, formats] of Object.entries(autoCaptions)) {
    if (matchTargetLanguage(key) === targetLang) {
      const isTranslated = isTranslatedTrack(key);
      candidates.push({
        trackKey: key,
        formats: formats || [],
        isAuto: true,
        priority: isTranslated ? 50 : 80
      });
    }
  }

  if (candidates.length === 0) return null;

  // Sắp xếp theo độ ưu tiên giảm dần
  candidates.sort((a, b) => b.priority - a.priority);
  const bestCandidate = candidates[0];

  // Chọn format tốt nhất trong danh sách formats: srt > vtt > json > json3 > srv1
  const formatList = bestCandidate.formats || [];
  const formatPriority = { srt: 10, vtt: 9, json: 8, json3: 7, srv1: 6, srv2: 5, srv3: 4, ttml: 3 };

  let bestFormat = null;
  let highestScore = -1;

  for (const f of formatList) {
    // Bỏ qua luồng m3u8 playlist phức tạp nếu có format trực tiếp khác
    const isM3u8 = (f.protocol || '').includes('m3u8') || (f.url || '').includes('.m3u8');
    const ext = (f.ext || '').toLowerCase();
    let score = formatPriority[ext] || 1;
    if (isM3u8) score -= 5;

    if (score > highestScore && f.url) {
      highestScore = score;
      bestFormat = f;
    }
  }

  return {
    trackKey: bestCandidate.trackKey,
    isAuto: bestCandidate.isAuto,
    format: bestFormat,
    allFormats: formatList
  };
}

/**
 * Trích xuất danh sách phụ đề khả dụng (cho 3 thứ tiếng vi, en, zh) từ metadata
 * @param {object} info 
 * @returns {Array<object>}
 */
export function getAvailableTranscripts(info) {
  if (!info) return [];

  const result = [];

  for (const langConfig of TARGET_LANGUAGES) {
    const bestTrack = findBestSubtitleTrack(info, langConfig.code);
    if (bestTrack && bestTrack.format) {
      result.push({
        lang: langConfig.code,
        label: langConfig.label,
        flag: langConfig.flag,
        isAuto: bestTrack.isAuto,
        trackKey: bestTrack.trackKey,
        formats: ['srt', 'txt'],
        available: true
      });
    }
  }

  return result;
}

export class TranscriptService {
  /**
   * Tải nội dung phụ đề thô từ URL trực tiếp hoặc fallback yt-dlp
   * @param {object} params
   * @param {string} params.url
   * @param {string} params.platform
   * @param {string} params.trackKey
   * @param {object} [params.formatObj]
   * @returns {Promise<{ content: string, ext: string }>}
   */
  async fetchRawSubtitle({ url, platform, trackKey, formatObj }) {
    // Cách 1: Fetch trực tiếp URL nếu khả dụng
    if (formatObj && formatObj.url && !formatObj.url.includes('.m3u8')) {
      try {
        const headers = {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        };

        if (platform === 'bilibili' || formatObj.url.includes('bilibili') || formatObj.url.includes('hdslb')) {
          headers['Referer'] = 'https://www.bilibili.com/';
        }

        const resp = await fetch(formatObj.url, { headers });
        if (resp.ok) {
          const body = await resp.text();
          // Kiểm tra xem phản hồi có phải là trang HTML lỗi / bot detection không
          if (body && !body.startsWith('<!DOCTYPE html') && !body.startsWith('<html') && !body.includes('<title>Sorry...</title>')) {
            return {
              content: body,
              ext: (formatObj.ext || 'srt').toLowerCase()
            };
          }
        }
      } catch (err) {
        console.warn(`[TranscriptService] Fetch URL trực tiếp thất bại (${err.message}). Chuyển sang fallback...`);
      }
    }

    // Cách 2: Sử dụng yt-dlp để tải file phụ đề
    return await ytdlpService.downloadSubtitleContent(url, trackKey, platform);
  }

  /**
   * Xử lý tải transcript chuyển đổi sang SRT hoặc TXT và stream về response
   * @param {object} params
   * @param {string} params.url
   * @param {string} params.lang
   * @param {string} params.format
   * @param {import('http').IncomingMessage} params.req
   * @param {import('http').ServerResponse} params.res
   */
  async downloadTranscript({ url, lang, format = 'srt', req, res }) {
    const targetLang = (lang || '').toLowerCase().trim();
    const validLangs = ['vi', 'en', 'zh'];

    if (!validLangs.includes(targetLang)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'error',
        message: `Ngôn ngữ '${lang}' không được hỗ trợ. Vui lòng chọn: 'vi' (Tiếng Việt), 'en' (Tiếng Anh), hoặc 'zh' (Tiếng Trung).`
      }));
    }

    const targetFormat = (format || 'srt').toLowerCase().trim();
    if (targetFormat !== 'srt' && targetFormat !== 'txt') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'error',
        message: `Định dạng '${format}' không hợp lệ. Vui lòng chọn 'srt' hoặc 'txt'.`
      }));
    }

    const langObj = TARGET_LANGUAGES.find(l => l.code === targetLang);
    const langLabel = langObj ? langObj.label : targetLang;

    // Trích xuất metadata để tìm track
    const extraArgs = [
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs', `${targetLang}.*`
    ];

    if (url.includes('bilibili')) {
      extraArgs.push('--add-header', 'Referer:https://www.bilibili.com/');
    }

    const metadata = await ytdlpService.getMetadata(url, { extraArgs });
    const bestTrack = findBestSubtitleTrack(metadata, targetLang);

    if (!bestTrack) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'error',
        message: `Không tìm thấy phụ đề/transcript ${langLabel} cho video này.`
      }));
    }

    const platform = url.includes('bilibili') ? 'bilibili' : 'youtube';
    const rawResult = await this.fetchRawSubtitle({
      url,
      platform,
      trackKey: bestTrack.trackKey,
      formatObj: bestTrack.format
    });

    if (!rawResult || !rawResult.content) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'error',
        message: `Không thể tải nội dung phụ đề ${langLabel} từ máy chủ nguồn.`
      }));
    }

    // Phân tích cues và chuyển đổi sang SRT hoặc TXT
    const cues = parseSubtitlesToCues(rawResult.content, rawResult.ext);
    if (!cues || cues.length === 0) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'error',
        message: `Không tìm thấy dòng phụ đề nào trong tệp nguồn của ${langLabel}.`
      }));
    }

    let outputContent = '';
    let mimeType = 'text/plain; charset=utf-8';

    if (targetFormat === 'srt') {
      outputContent = cuesToSrt(cues);
      mimeType = 'application/x-subrip; charset=utf-8';
    } else {
      outputContent = cuesToTxt(cues);
      mimeType = 'text/plain; charset=utf-8';
    }

    const title = metadata.title || 'video';
    const filename = `${title}_transcript_${targetLang}`;
    const { contentDisposition } = getSafeContentDisposition(filename, targetFormat);

    const buffer = Buffer.from(outputContent, 'utf-8');

    res.writeHead(200, {
      'Content-Type': mimeType,
      'Content-Disposition': contentDisposition,
      'Content-Length': buffer.length,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    });

    res.end(buffer);
  }
}

export const transcriptService = new TranscriptService();

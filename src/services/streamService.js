import { spawn, spawnSync } from 'node:child_process';
import { Readable } from 'node:stream';
import { getSafeContentDisposition } from '../utils/formatHelper.js';

let ffmpegStaticPath = null;
try {
  const ffmpegModule = await import('ffmpeg-static');
  ffmpegStaticPath = ffmpegModule.default || ffmpegModule;
} catch {
  ffmpegStaticPath = process.env.FFMPEG_PATH || 'ffmpeg';
}

/**
 * Lấy binary FFmpeg khả dụng.
 * Ưu tiên binary hệ thống trong PATH (như /usr/bin/ffmpeg trên Linux/Alpine)
 * để tránh lỗi phân giải DNS do static glibc binary trong môi trường musl libc.
 */
export function getAvailableFFmpeg() {
  if (process.env.FFMPEG_PATH) {
    return process.env.FFMPEG_PATH;
  }
  try {
    const res = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    if (res.status === 0) {
      return 'ffmpeg';
    }
  } catch {}
  return ffmpegStaticPath || 'ffmpeg';
}

let archiverModule = null;
try {
  archiverModule = (await import('archiver')).default;
} catch {
  archiverModule = null;
}

export class StreamService {
  /**
   * Truyền trực tiếp dữ liệu (Direct Pipe) từ URL nguồn vào response của client
   * @param {object} params
   * @param {string} params.mediaUrl
   * @param {string} params.filename
   * @param {string} params.mimeType
   * @param {object} params.customHeaders
   * @param {import('http').IncomingMessage} params.req
   * @param {import('http').ServerResponse} params.res
   */
  async pipeDirectStream({ mediaUrl, filename, mimeType = 'video/mp4', customHeaders = {}, req, res }) {
    const controller = new AbortController();
    let isClientDisconnected = false;

    // Quản lý vòng đời kết nối: client ngắt kết nối thì hủy ngay request nguồn
    req.on('close', () => {
      isClientDisconnected = true;
      controller.abort();
    });

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      ...customHeaders
    };

    const upstreamResponse = await fetch(mediaUrl, {
      headers,
      signal: controller.signal
    });

    if (!upstreamResponse.ok) {
      throw new Error(`Nguồn trả về mã lỗi: ${upstreamResponse.status} ${upstreamResponse.statusText}`);
    }

    const { contentDisposition } = getSafeContentDisposition(filename, mimeType.includes('audio') ? 'mp3' : 'mp4');
    const contentLength = upstreamResponse.headers.get('content-length');

    const resHeaders = {
      'Content-Type': mimeType,
      'Content-Disposition': contentDisposition,
      'Cache-Control': 'no-cache',
      'X-Content-Type-Options': 'nosniff'
    };

    if (contentLength) {
      resHeaders['Content-Length'] = contentLength;
    }

    res.writeHead(200, resHeaders);

    if (!upstreamResponse.body) {
      res.end();
      return;
    }

    // Pipe Readable WebStream sang Node.js Stream
    const nodeStream = Readable.fromWeb(upstreamResponse.body);
    nodeStream.on('error', err => {
      if (!isClientDisconnected) {
        console.error('[StreamService] Lỗi stream pipe:', err.message);
      }
    });

    nodeStream.pipe(res);
  }

  /**
   * Remux video và audio on-the-fly qua FFmpeg (Fragmented MP4), không lưu ổ đĩa
   * @param {object} params
   * @param {string} params.videoUrl
   * @param {string} params.audioUrl
   * @param {string} [params.audioCodec]
   * @param {string} params.filename
   * @param {object} params.customHeaders
   * @param {import('http').IncomingMessage} params.req
   * @param {import('http').ServerResponse} params.res
   */
  async pipeMuxedStream({ videoUrl, audioUrl, audioCodec = '', filename, customHeaders = {}, req, res }) {
    const { contentDisposition } = getSafeContentDisposition(filename, 'mp4');

    const ffmpegBin = getAvailableFFmpeg();
    const ffmpegArgs = [];

    const userAgent = (customHeaders && customHeaders['User-Agent']) ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    ffmpegArgs.push('-user_agent', userAgent);

    // Header cho input video
    if (customHeaders && Object.keys(customHeaders).length > 0) {
      const headerStr = Object.entries(customHeaders)
        .map(([k, v]) => `${k}: ${v}\r\n`)
        .join('');
      ffmpegArgs.push('-headers', headerStr);
    }
    ffmpegArgs.push('-i', videoUrl);

    // Header cho input audio
    if (customHeaders && Object.keys(customHeaders).length > 0) {
      const headerStr = Object.entries(customHeaders)
        .map(([k, v]) => `${k}: ${v}\r\n`)
        .join('');
      ffmpegArgs.push('-headers', headerStr);
    }
    ffmpegArgs.push('-i', audioUrl);

    // Video stream: copy trực tiếp
    ffmpegArgs.push('-c:v', 'copy');

    // Audio stream: nếu luồng gốc là AAC/mp4a thì copy; nếu là Opus/WebM thì transcode sang aac để tương thích tối đa Windows Media Player / iOS / Android
    const isAac = audioCodec && (audioCodec.toLowerCase().includes('aac') || audioCodec.toLowerCase().includes('mp4a'));
    if (isAac) {
      ffmpegArgs.push('-c:a', 'copy');
    } else {
      ffmpegArgs.push('-c:a', 'aac', '-b:a', '192k');
    }

    // Cấu hình fragmented MP4 trực tiếp qua pipe stdout
    ffmpegArgs.push(
      '-f', 'mp4',
      '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
      'pipe:1'
    );

    const ffmpegProcess = spawn(ffmpegBin, ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let isCleanedUp = false;
    let hasSentHeaders = false;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      if (!ffmpegProcess.killed) {
        ffmpegProcess.kill('SIGKILL');
      }
    };

    // Client ngắt kết nối giữa chừng -> Dọn sạch FFmpeg tiến trình con, chống Zombie process
    req.on('close', cleanup);
    res.on('finish', cleanup);
    res.on('error', cleanup);

    let stderrLogs = '';
    ffmpegProcess.stderr.on('data', data => {
      const str = data.toString();
      stderrLogs += str;
      if (stderrLogs.length > 2000) {
        stderrLogs = stderrLogs.slice(-2000);
      }
    });

    ffmpegProcess.on('error', err => {
      console.error('[FFmpeg Process Error]:', err.message);
      cleanup();
      if (!hasSentHeaders && !res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'error', message: 'Lỗi khởi chạy FFmpeg remuxing.' }));
      }
    });

    // Chỉ gửi header HTTP 200 khi luồng stdout thực sự có dữ liệu đầu tiên
    ffmpegProcess.stdout.once('data', (firstChunk) => {
      hasSentHeaders = true;
      res.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Disposition': contentDisposition,
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        'X-Content-Type-Options': 'nosniff'
      });
      res.write(firstChunk);
      ffmpegProcess.stdout.pipe(res);
    });

    return new Promise((resolve) => {
      ffmpegProcess.on('close', (code) => {
        cleanup();
        if (!hasSentHeaders) {
          console.error('[FFmpeg Remux Failed]: Code', code, stderrLogs.slice(0, 300));
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'error', message: 'Không thể kết nối hoặc hòa trộn luồng video từ máy chủ nguồn.' }));
          }
        }
        resolve();
      });
    });
  }

  /**
   * Đóng gói và stream trực tiếp album ảnh dạng ZIP
   * @param {object} params
   * @param {string[]} params.photoUrls
   * @param {string} params.filename
   * @param {import('http').IncomingMessage} params.req
   * @param {import('http').ServerResponse} params.res
   */
  async pipePhotoAlbumZip({ photoUrls, filename, req, res }) {
    if (!archiverModule) {
      throw new Error('Chức năng đóng gói ZIP chưa sẵn sàng (archiver chưa được tải).');
    }

    const { contentDisposition } = getSafeContentDisposition(filename, 'zip');

    res.writeHead(200, {
      'Content-Type': 'application/zip',
      'Content-Disposition': contentDisposition,
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache'
    });

    const archive = archiverModule('zip', { zlib: { level: 5 } });

    let isClientDisconnected = false;
    req.on('close', () => {
      isClientDisconnected = true;
      archive.abort();
    });

    archive.pipe(res);

    for (let i = 0; i < photoUrls.length; i++) {
      if (isClientDisconnected) break;
      const photoUrl = photoUrls[i];
      try {
        const photoRes = await fetch(photoUrl);
        if (photoRes.ok && photoRes.body) {
          const stream = Readable.fromWeb(photoRes.body);
          archive.append(stream, { name: `photo_${(i + 1).toString().padStart(2, '0')}.jpg` });
        }
      } catch (err) {
        console.warn(`[StreamService] Không thể tải ảnh index ${i}:`, err.message);
      }
    }

    await archive.finalize();
  }
}

export const streamService = new StreamService();

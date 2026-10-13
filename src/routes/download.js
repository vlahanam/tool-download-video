import { extractMediaInfo } from '../extractors/index.js';
import { streamService } from '../services/streamService.js';

/**
 * Xử lý endpoint /api/download
 * @param {import('express').Request|any} req 
 * @param {import('express').Response|any} res 
 */
export async function handleDownloadRoute(req, res) {
  const query = req.query || Object.fromEntries((new URL(req.url, `http://${req.headers.host}`)).searchParams);
  const { url, format_id, mode } = query;

  if (!url) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'error', message: 'Thiếu tham số url.' }));
  }

  try {
    const data = await extractMediaInfo(url);

    // 1. Tải album ảnh TikTok dạng ZIP
    if (mode === 'photos' || (data.isPhotoAlbum && (!format_id || format_id === 'photos'))) {
      if (!data.photos || data.photos.length === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'error', message: 'Không tìm thấy ảnh trong bài đăng.' }));
      }
      return await streamService.pipePhotoAlbumZip({
        photoUrls: data.photos,
        filename: `${data.title || 'tiktok_photos'}_album`,
        req,
        res
      });
    }

    // 2. Tìm format tương ứng
    let selectedFormat = null;
    if (format_id) {
      selectedFormat = data.formats.find(f => f.id === format_id || f.format_id === format_id);
    }

    // Mặc định chọn format đầu tiên (chất lượng cao nhất)
    if (!selectedFormat && data.formats.length > 0) {
      selectedFormat = data.formats[0];
    }

    if (!selectedFormat) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'error', message: 'Không tìm thấy định dạng yêu cầu.' }));
    }

    const filename = `${data.title || 'video'}_${selectedFormat.id || 'media'}`;

    // 3. Phân nhánh xử lý stream: Muxed vs Direct Pipe
    if (selectedFormat.needMux && selectedFormat.audioUrl) {
      return await streamService.pipeMuxedStream({
        videoUrl: selectedFormat.url,
        audioUrl: selectedFormat.audioUrl,
        audioCodec: selectedFormat.audioCodec || '',
        filename,
        customHeaders: selectedFormat.headers || {},
        req,
        res
      });
    } else {
      const mimeType = selectedFormat.type === 'audio' ? 'audio/mpeg' : 'video/mp4';
      return await streamService.pipeDirectStream({
        mediaUrl: selectedFormat.url,
        filename,
        mimeType,
        customHeaders: selectedFormat.headers || {},
        req,
        res
      });
    }
  } catch (err) {
    if (!res.headersSent) {
      const isClientError = err.message.includes('SSRF') ||
        err.message.includes('không hợp lệ') ||
        err.message.includes('vượt quá');
      res.writeHead(isClientError ? 400 : 500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: err.message }));
    } else {
      console.error('[handleDownloadRoute] Stream bị lỗi giữa chừng:', err.message);
    }
  }
}

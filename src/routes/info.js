import { extractMediaInfo } from '../extractors/index.js';

/**
 * Xử lý endpoint /api/info
 * @param {import('express').Request|any} req 
 * @param {import('express').Response|any} res 
 */
export async function handleInfoRoute(req, res) {
  const url = req.query?.url || (new URL(req.url, `http://${req.headers.host}`)).searchParams.get('url');

  if (!url) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'error',
      message: 'Tham số url là bắt buộc. Ví dụ: /api/info?url=https://...'
    }));
  }

  try {
    const data = await extractMediaInfo(url);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(data));
  } catch (err) {
    const isClientError = err.message.includes('SSRF') ||
      err.message.includes('không hợp lệ') ||
      err.message.includes('không được hỗ trợ') ||
      err.message.includes('vượt quá giới hạn');

    const statusCode = isClientError ? 400 : 500;
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      status: 'error',
      message: err.message
    }));
  }
}

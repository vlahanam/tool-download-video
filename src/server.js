import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config.js';
import { handleInfoRoute } from './routes/info.js';
import { handleDownloadRoute } from './routes/download.js';

const publicDir = path.join(config.rootDir, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * Phục vụ các file tĩnh trong thư mục public
 */
function serveStaticFile(req, res, pathname) {
  let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const filePath = path.join(publicDir, relativePath);

  // Chống Directory Traversal
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600'
    });
    fs.createReadStream(filePath).pipe(res);
    return true;
  }
  return false;
}

/**
 * Tạo HTTP request listener tương thích Express & native HTTP
 */
export function createRequestListener() {
  return async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const host = req.headers.host || `localhost:${config.port}`;
    const parsedUrl = new URL(req.url, `http://${host}`);
    const pathname = parsedUrl.pathname;

    // Healthcheck
    if (pathname === '/api/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      }));
    }

    // API: Info
    if (pathname === '/api/info') {
      return await handleInfoRoute(req, res);
    }

    // API: Download
    if (pathname === '/api/download') {
      return await handleDownloadRoute(req, res);
    }

    // Phục vụ file giao diện (Frontend)
    if (serveStaticFile(req, res, pathname)) {
      return;
    }

    // Route không tồn tại (404)
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'error', message: 'Tài nguyên không tồn tại (404).' }));
  };
}

/**
 * Khởi động server
 */
export function startServer(port = config.port) {
  const listener = createRequestListener();
  const server = http.createServer(listener);

  server.listen(port, config.host, () => {
    console.log(`====================================================`);
    console.log(`🚀 Video Downloader đang chạy tại: http://${config.host === '0.0.0.0' ? 'localhost' : config.host}:${port}`);
    console.log(`⚡ Chế độ: ${config.env.toUpperCase()} | Diskless Streaming Proxy`);
    console.log(`====================================================`);
  });

  const shutdown = () => {
    console.log('\n[Server] Đang đóng kết nối và tắt an toàn...');
    server.close(() => {
      console.log('[Server] Đã tắt hoàn tất.');
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return server;
}

// Chạy trực tiếp nếu file được gọi bằng node
if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  startServer();
}

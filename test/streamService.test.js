import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EventEmitter } from 'node:events';
import { streamService } from '../src/services/streamService.js';

describe('StreamService Diskless Engine', () => {
  it('xử lý direct stream pipe thành công với mock response', async () => {
    // Giả lập req và res
    const req = new EventEmitter();
    const res = new EventEmitter();
    res.headers = {};
    res.statusCode = 0;
    res.writtenChunks = [];
    res.ended = false;

    res.writeHead = (status, headers) => {
      res.statusCode = status;
      res.headers = headers;
    };

    res.write = (chunk) => {
      res.writtenChunks.push(chunk);
    };

    res.end = () => {
      res.ended = true;
    };

    // Tạo server mock cục bộ để test pipeDirectStream
    const http = await import('node:http');
    const mockServer = http.createServer((mockReq, mockRes) => {
      mockRes.writeHead(200, {
        'Content-Type': 'video/mp4',
        'Content-Length': '12'
      });
      mockRes.end('mock-payload');
    });

    await new Promise(r => mockServer.listen(0, '127.0.0.1', r));
    const port = mockServer.address().port;

    try {
      await streamService.pipeDirectStream({
        mediaUrl: `http://127.0.0.1:${port}/mock.mp4`,
        filename: 'test_video',
        mimeType: 'video/mp4',
        req,
        res
      });

      assert.strictEqual(res.statusCode, 200);
      assert.strictEqual(res.headers['Content-Type'], 'video/mp4');
      assert.ok(res.headers['Content-Disposition'].includes('test_video.mp4'));
    } finally {
      mockServer.close();
    }
  });

  it('hủy upstream fetch khi client ngắt kết nối (req close event)', async () => {
    const req = new EventEmitter();
    const res = new EventEmitter();
    res.writeHead = () => {};
    res.end = () => {};

    // Gửi sự kiện close ngay khi bắt đầu
    let abortDetected = false;
    const http = await import('node:http');
    const slowServer = http.createServer((mockReq, mockRes) => {
      mockReq.on('close', () => {
        abortDetected = true;
      });
      mockRes.writeHead(200, { 'Content-Type': 'video/mp4' });
      // Không end ngay để chờ pipe
    });

    await new Promise(r => slowServer.listen(0, '127.0.0.1', r));
    const port = slowServer.address().port;

    try {
      const streamPromise = streamService.pipeDirectStream({
        mediaUrl: `http://127.0.0.1:${port}/slow.mp4`,
        filename: 'slow_video',
        req,
        res
      });

      // Bắn sự kiện client ngắt kết nối
      setTimeout(() => {
        req.emit('close');
      }, 50);

      await assert.rejects(async () => {
        await streamPromise;
      });
    } finally {
      slowServer.close();
    }
  });
});

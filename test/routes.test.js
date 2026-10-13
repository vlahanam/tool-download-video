import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import { createRequestListener } from '../src/server.js';

describe('Server & API Routes Integration Test', () => {
  let server;
  let baseUrl;

  before(async () => {
    const listener = createRequestListener();
    server = http.createServer(listener);
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', resolve);
    });
    const address = server.address();
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /api/health trả về status ok', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
  });

  it('GET / trả về trang giao diện HTML', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Cobalt Media Downloader'));
    assert.ok(text.includes('id="urlInput"'));
  });

  it('GET /style.css trả về nội dung CSS', async () => {
    const res = await fetch(`${baseUrl}/style.css`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('--bg-surface'));
  });

  it('GET /app.js trả về file javascript client', async () => {
    const res = await fetch(`${baseUrl}/app.js`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('addEventListener'));
  });

  it('GET /tailwind.min.js trả về thư viện Tailwind CSS client', async () => {
    const res = await fetch(`${baseUrl}/tailwind.min.js`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.length > 10000);
  });

  it('GET /api/info không truyền url -> trả về lỗi 400', async () => {
    const res = await fetch(`${baseUrl}/api/info`);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.status, 'error');
    assert.match(data.message, /bắt buộc/);
  });

  it('GET /api/info với URL SSRF nội bộ -> trả về lỗi 400', async () => {
    const res = await fetch(`${baseUrl}/api/info?url=http://127.0.0.1:8080/admin`);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.status, 'error');
    assert.match(data.message, /SSRF/);
  });

  it('GET /api/info với domain không hỗ trợ -> trả về lỗi 400', async () => {
    const res = await fetch(`${baseUrl}/api/info?url=https://facebook.com/watch?v=123`);
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.status, 'error');
    assert.match(data.message, /không được hỗ trợ/);
  });

  it('GET /random-path-not-found trả về 404', async () => {
    const res = await fetch(`${baseUrl}/non-existent-page`);
    assert.strictEqual(res.status, 404);
  });
});


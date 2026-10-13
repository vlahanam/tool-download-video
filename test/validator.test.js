import { describe, it } from 'node:test';
import assert from 'node:assert';
import { validateMediaUrl, isDurationAllowed } from '../src/utils/validator.js';

describe('Validator Utility & SSRF Protection', () => {
  it('chấp nhận URL TikTok hợp lệ', () => {
    const res = validateMediaUrl('https://www.tiktok.com/@user/video/1234567890');
    assert.strictEqual(res.valid, true);
    assert.strictEqual(res.platform, 'tiktok');
  });

  it('chấp nhận URL YouTube hợp lệ', () => {
    const res1 = validateMediaUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.strictEqual(res1.valid, true);
    assert.strictEqual(res1.platform, 'youtube');

    const res2 = validateMediaUrl('https://youtu.be/dQw4w9WgXcQ');
    assert.strictEqual(res2.valid, true);
    assert.strictEqual(res2.platform, 'youtube');
  });

  it('chấp nhận URL Bilibili hợp lệ', () => {
    const res1 = validateMediaUrl('https://www.bilibili.com/video/BV1xx411c7mD');
    assert.strictEqual(res1.valid, true);
    assert.strictEqual(res1.platform, 'bilibili');

    const res2 = validateMediaUrl('https://www.bilibili.tv/en/video/2048');
    assert.strictEqual(res2.valid, true);
    assert.strictEqual(res2.platform, 'bilibili');
  });

  it('chặn URL SSRF nội bộ (localhost, 127.0.0.1, 169.254.169.254)', () => {
    const resLocal = validateMediaUrl('http://localhost:3000/secret');
    assert.strictEqual(resLocal.valid, false);
    assert.match(resLocal.error, /SSRF/);

    const resLoopback = validateMediaUrl('http://127.0.0.1/admin');
    assert.strictEqual(resLoopback.valid, false);
    assert.match(resLoopback.error, /SSRF/);

    const resMetadata = validateMediaUrl('http://169.254.169.254/latest/meta-data');
    assert.strictEqual(resMetadata.valid, false);
    assert.match(resMetadata.error, /SSRF/);
  });

  it('từ chối domain không được hỗ trợ', () => {
    const res = validateMediaUrl('https://facebook.com/watch?v=123');
    assert.strictEqual(res.valid, false);
    assert.match(res.error, /không được hỗ trợ/);
  });

  it('kiểm tra giới hạn thời lượng video', () => {
    assert.strictEqual(isDurationAllowed(600), true); // 10 phút -> hợp lệ
    assert.strictEqual(isDurationAllowed(1800), true); // 30 phút -> hợp lệ
    assert.strictEqual(isDurationAllowed(3600), false); // 60 phút -> vượt quá giới hạn
  });
});

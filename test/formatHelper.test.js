import { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatDuration, formatFileSize, getSafeContentDisposition } from '../src/utils/formatHelper.js';

describe('FormatHelper Utilities', () => {
  it('định dạng thời lượng (seconds -> mm:ss hoặc hh:mm:ss)', () => {
    assert.strictEqual(formatDuration(0), '00:00');
    assert.strictEqual(formatDuration(65), '01:05');
    assert.strictEqual(formatDuration(3665), '1:01:05');
  });

  it('định dạng kích thước file (bytes -> KB, MB, GB)', () => {
    assert.strictEqual(formatFileSize(1024), '1.0 KB');
    assert.strictEqual(formatFileSize(10485760), '10.0 MB');
    assert.strictEqual(formatFileSize(1073741824), '1.0 GB');
  });

  it('làm sạch tiêu đề và xuất Content-Disposition header an toàn', () => {
    const { asciiFilename, contentDisposition } = getSafeContentDisposition('Bài hát: "Xin chào Việt Nam" / 2024?');
    assert.ok(asciiFilename.endsWith('.mp4'));
    assert.ok(!asciiFilename.includes('"'));
    assert.ok(!asciiFilename.includes('/'));
    assert.ok(!asciiFilename.includes('?'));
    assert.ok(contentDisposition.includes('attachment; filename='));
    assert.ok(contentDisposition.includes("filename*=UTF-8''"));
  });
});

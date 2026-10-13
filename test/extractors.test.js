import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractMediaInfo } from '../src/extractors/index.js';

describe('Extractors Dispatcher', () => {
  it('từ chối URL không hợp lệ trước khi gọi extractor', async () => {
    await assert.rejects(
      async () => {
        await extractMediaInfo('invalid-url-string');
      },
      {
        message: /Định dạng URL không hợp lệ/
      }
    );
  });

  it('chặn URL localhost trước khi gọi extractor', async () => {
    await assert.rejects(
      async () => {
        await extractMediaInfo('http://localhost:8080/exploit');
      },
      {
        message: /SSRF Protection/
      }
    );
  });

  it('từ chối URL thuộc domain không được hỗ trợ', async () => {
    await assert.rejects(
      async () => {
        await extractMediaInfo('https://instagram.com/reel/12345');
      },
      {
        message: /không được hỗ trợ/
      }
    );
  });
});

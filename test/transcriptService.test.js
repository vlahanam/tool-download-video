import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  matchTargetLanguage,
  isTranslatedTrack,
  unescapeHtml,
  msToSrtTime,
  parseTimeToMs,
  parseSubtitlesToCues,
  cuesToSrt,
  cuesToTxt,
  findBestSubtitleTrack,
  getAvailableTranscripts
} from '../src/services/transcriptService.js';

describe('TranscriptService Unit Tests', () => {
  describe('Khớp ngôn ngữ (matchTargetLanguage)', () => {
    it('nhận diện chính xác các mã tiếng Việt', () => {
      assert.strictEqual(matchTargetLanguage('vi'), 'vi');
      assert.strictEqual(matchTargetLanguage('vi-VN'), 'vi');
      assert.strictEqual(matchTargetLanguage('vi_VN'), 'vi');
      assert.strictEqual(matchTargetLanguage('vie'), 'vi');
      assert.strictEqual(matchTargetLanguage('vietnamese'), 'vi');
      assert.strictEqual(matchTargetLanguage('vi-en'), 'vi');
    });

    it('nhận diện chính xác các mã tiếng Anh', () => {
      assert.strictEqual(matchTargetLanguage('en'), 'en');
      assert.strictEqual(matchTargetLanguage('en-US'), 'en');
      assert.strictEqual(matchTargetLanguage('en-GB'), 'en');
      assert.strictEqual(matchTargetLanguage('en-orig'), 'en');
      assert.strictEqual(matchTargetLanguage('eng'), 'en');
      assert.strictEqual(matchTargetLanguage('english'), 'en');
      assert.strictEqual(matchTargetLanguage('en-de'), 'en');
    });

    it('nhận diện chính xác các mã tiếng Trung', () => {
      assert.strictEqual(matchTargetLanguage('zh'), 'zh');
      assert.strictEqual(matchTargetLanguage('zh-Hans'), 'zh');
      assert.strictEqual(matchTargetLanguage('zh-Hant'), 'zh');
      assert.strictEqual(matchTargetLanguage('zh-CN'), 'zh');
      assert.strictEqual(matchTargetLanguage('zh-TW'), 'zh');
      assert.strictEqual(matchTargetLanguage('zh-HK'), 'zh');
      assert.strictEqual(matchTargetLanguage('ai-zh'), 'zh');
      assert.strictEqual(matchTargetLanguage('chi'), 'zh');
      assert.strictEqual(matchTargetLanguage('zho'), 'zh');
      assert.strictEqual(matchTargetLanguage('zh-Hans-en'), 'zh');
    });

    it('từ chối các ngôn ngữ không thuộc phạm vi yêu cầu', () => {
      assert.strictEqual(matchTargetLanguage('ja'), null);
      assert.strictEqual(matchTargetLanguage('ko'), null);
      assert.strictEqual(matchTargetLanguage('fr'), null);
      assert.strictEqual(matchTargetLanguage('es'), null);
      assert.strictEqual(matchTargetLanguage('de'), null);
      assert.strictEqual(matchTargetLanguage(''), null);
      assert.strictEqual(matchTargetLanguage(null), null);
    });
  });

  describe('Kiểm tra track dịch tự động (isTranslatedTrack)', () => {
    it('nhận biết đúng các track dịch tự động vi-en, zh-Hans-en', () => {
      assert.strictEqual(isTranslatedTrack('vi-en'), true);
      assert.strictEqual(isTranslatedTrack('zh-Hans-en'), true);
      assert.strictEqual(isTranslatedTrack('en-de'), true);
    });

    it('không nhận nhầm track gốc vi, en, zh-Hans, en-orig', () => {
      assert.strictEqual(isTranslatedTrack('vi'), false);
      assert.strictEqual(isTranslatedTrack('en'), false);
      assert.strictEqual(isTranslatedTrack('zh-Hans'), false);
      assert.strictEqual(isTranslatedTrack('en-orig'), false);
    });
  });

  describe('Chuyển đổi thời gian & HTML unescape', () => {
    it('msToSrtTime format chuẩn HH:MM:SS,mmm', () => {
      assert.strictEqual(msToSrtTime(0), '00:00:00,000');
      assert.strictEqual(msToSrtTime(1500), '00:00:01,500');
      assert.strictEqual(msToSrtTime(65432), '00:01:05,432');
      assert.strictEqual(msToSrtTime(3665123), '01:01:05,123');
    });

    it('parseTimeToMs phân tích chuỗi thời gian SRT / VTT', () => {
      assert.strictEqual(parseTimeToMs('00:00:01,500'), 1500);
      assert.strictEqual(parseTimeToMs('00:01:05.432'), 65432);
      assert.strictEqual(parseTimeToMs('01:05.432'), 65432);
      assert.strictEqual(parseTimeToMs('12.5'), 12500);
    });

    it('unescapeHtml giải mã các ký tự thực thể đặc biệt', () => {
      const input = 'Tom &amp; Jerry &lt;cartoons&gt; &#39;fun&#39; &quot;classic&quot;';
      assert.strictEqual(unescapeHtml(input), 'Tom & Jerry <cartoons> \'fun\' "classic"');
    });
  });

  describe('Phân tích phụ đề sang cues (parseSubtitlesToCues)', () => {
    it('xử lý định dạng WebVTT', () => {
      const vtt = `WEBVTT
Kind: captions
Language: en

00:00:01.200 --> 00:00:03.360
Hello <b>World</b>!

00:00:04.500 --> 00:00:06.800
This is a test.`;

      const cues = parseSubtitlesToCues(vtt, 'vtt');
      assert.strictEqual(cues.length, 2);
      assert.strictEqual(cues[0].startMs, 1200);
      assert.strictEqual(cues[0].endMs, 3360);
      assert.strictEqual(cues[0].text, 'Hello World!');
      assert.strictEqual(cues[1].text, 'This is a test.');
    });

    it('xử lý định dạng SRT chuẩn', () => {
      const srt = `1
00:00:01,000 --> 00:00:02,500
Xin chào Việt Nam

2
00:00:03,000 --> 00:00:05,200
Đất nước tươi đẹp`;

      const cues = parseSubtitlesToCues(srt, 'srt');
      assert.strictEqual(cues.length, 2);
      assert.strictEqual(cues[0].text, 'Xin chào Việt Nam');
      assert.strictEqual(cues[1].startMs, 3000);
      assert.strictEqual(cues[1].text, 'Đất nước tươi đẹp');
    });

    it('xử lý định dạng Bilibili BCC (JSON)', () => {
      const bcc = {
        font_size: 0.4,
        body: [
          { from: 1.5, to: 3.2, content: '你好，世界！' },
          { from: 3.5, to: 5.8, content: '哔哩哔哩弹幕网' }
        ]
      };

      const cues = parseSubtitlesToCues(bcc, 'json');
      assert.strictEqual(cues.length, 2);
      assert.strictEqual(cues[0].startMs, 1500);
      assert.strictEqual(cues[0].endMs, 3200);
      assert.strictEqual(cues[0].text, '你好，世界！');
      assert.strictEqual(cues[1].text, '哔哩哔哩弹幕网');
    });

    it('xử lý định dạng YouTube JSON3', () => {
      const json3 = {
        events: [
          {
            tStartMs: 500,
            dDurationMs: 1500,
            segs: [{ utf8: 'Chúc mừng ' }, { utf8: 'năm mới' }]
          },
          {
            tStartMs: 2500,
            dDurationMs: 2000,
            segs: [{ utf8: 'Vạn sự như ý' }]
          }
        ]
      };

      const cues = parseSubtitlesToCues(json3, 'json3');
      assert.strictEqual(cues.length, 2);
      assert.strictEqual(cues[0].startMs, 500);
      assert.strictEqual(cues[0].endMs, 2000);
      assert.strictEqual(cues[0].text, 'Chúc mừng năm mới');
      assert.strictEqual(cues[1].text, 'Vạn sự như ý');
    });

    it('xử lý định dạng YouTube SRV1 / XML', () => {
      const xml = `<transcript>
        <text start="1.5" dur="2.0">Học &amp; phát triển</text>
        <text start="4.0" dur="1.5">Công nghệ AI</text>
      </transcript>`;

      const cues = parseSubtitlesToCues(xml, 'srv1');
      assert.strictEqual(cues.length, 2);
      assert.strictEqual(cues[0].startMs, 1500);
      assert.strictEqual(cues[0].endMs, 3500);
      assert.strictEqual(cues[0].text, 'Học & phát triển');
      assert.strictEqual(cues[1].text, 'Công nghệ AI');
    });
  });

  describe('Chuyển đổi cues thành SRT và TXT (cuesToSrt & cuesToTxt)', () => {
    const sampleCues = [
      { startMs: 1000, endMs: 3000, text: 'Dòng thứ nhất' },
      { startMs: 3200, endMs: 5000, text: 'Dòng thứ hai' },
      { startMs: 5200, endMs: 6000, text: 'Dòng thứ hai' } // Lặp lại liên tiếp
    ];

    it('cuesToSrt tạo ra định dạng SubRip hợp lệ', () => {
      const srt = cuesToSrt(sampleCues);
      assert.ok(srt.includes('1\n00:00:01,000 --> 00:00:03,000\nDòng thứ nhất'));
      assert.ok(srt.includes('2\n00:00:03,200 --> 00:00:05,000\nDòng thứ hai'));
    });

    it('cuesToTxt trích xuất văn bản sạch và lọc trùng lặp liên tiếp', () => {
      const txt = cuesToTxt(sampleCues);
      const lines = txt.split('\n');
      assert.strictEqual(lines.length, 2);
      assert.strictEqual(lines[0], 'Dòng thứ nhất');
      assert.strictEqual(lines[1], 'Dòng thứ hai');
    });
  });

  describe('Lựa chọn track & metadata (findBestSubtitleTrack & getAvailableTranscripts)', () => {
    const mockMetadata = {
      subtitles: {
        en: [
          { ext: 'srt', url: 'https://example.com/en.srt' },
          { ext: 'vtt', url: 'https://example.com/en.vtt' }
        ],
        'zh-Hans': [
          { ext: 'json', url: 'https://example.com/zh.json' }
        ]
      },
      automatic_captions: {
        vi: [
          { ext: 'srt', url: 'https://example.com/vi.srt' }
        ],
        'vi-en': [
          { ext: 'srt', url: 'https://example.com/vi-en.srt' }
        ]
      }
    };

    it('findBestSubtitleTrack ưu tiên creator subtitle hơn auto caption', () => {
      const enTrack = findBestSubtitleTrack(mockMetadata, 'en');
      assert.strictEqual(enTrack.trackKey, 'en');
      assert.strictEqual(enTrack.isAuto, false);
      assert.strictEqual(enTrack.format.ext, 'srt');
    });

    it('findBestSubtitleTrack chọn track tiếng Việt tự động gốc thay vì bản dịch', () => {
      const viTrack = findBestSubtitleTrack(mockMetadata, 'vi');
      assert.strictEqual(viTrack.trackKey, 'vi');
      assert.strictEqual(viTrack.isAuto, true);
    });

    it('getAvailableTranscripts phát hiện đủ 3 thứ tiếng khi metadata có sẵn', () => {
      const available = getAvailableTranscripts(mockMetadata);
      assert.strictEqual(available.length, 3);

      const viItem = available.find(t => t.lang === 'vi');
      const enItem = available.find(t => t.lang === 'en');
      const zhItem = available.find(t => t.lang === 'zh');

      assert.ok(viItem);
      assert.strictEqual(viItem.label, 'Tiếng Việt');
      assert.deepStrictEqual(viItem.formats, ['srt', 'txt']);

      assert.ok(enItem);
      assert.strictEqual(enItem.label, 'Tiếng Anh');

      assert.ok(zhItem);
      assert.strictEqual(zhItem.label, 'Tiếng Trung');
    });
  });
});

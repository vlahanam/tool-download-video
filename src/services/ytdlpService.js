import fs from 'node:fs';
import { spawn } from 'node:child_process';
import { config } from '../config.js';

export class YtdlpService {
  constructor() {
    this.binaryPath = config.ytdlpPath;
  }

  /**
   * Lấy binary path khả dụng
   */
  getExecutable() {
    if (fs.existsSync(this.binaryPath)) {
      return this.binaryPath;
    }
    return 'yt-dlp'; // fallback PATH hệ thống
  }

  /**
   * Kiểm tra cookies file có hợp lệ và là file thực tế có dung lượng không
   */
  hasValidCookiesFile() {
    if (!config.cookiesPath) return false;
    try {
      if (fs.existsSync(config.cookiesPath)) {
        const stat = fs.statSync(config.cookiesPath);
        return stat.isFile() && stat.size > 0;
      }
    } catch {
      return false;
    }
    return false;
  }

  /**
   * Trích xuất thông tin media dưới dạng JSON
   * @param {string} url 
   * @param {object} options 
   * @returns {Promise<object>}
   */
  async getMetadata(url, options = {}) {
    const args = [
      '--dump-single-json',
      '--no-playlist',
      '--no-warnings',
      '--no-check-certificates',
      '--prefer-free-formats',
      url
    ];

    // Gắn cookies nếu tồn tại và là file hợp lệ
    if (this.hasValidCookiesFile()) {
      args.unshift('--cookies', config.cookiesPath);
    }

    if (options.extraArgs && Array.isArray(options.extraArgs)) {
      args.push(...options.extraArgs);
    }

    return new Promise((resolve, reject) => {
      const child = spawn(this.getExecutable(), args);
      let stdoutData = '';
      let stderrData = '';

      const timeout = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('Yêu cầu trích xuất thông tin quá thời gian cho phép (Timeout).'));
      }, config.requestTimeoutMs);

      child.stdout.on('data', chunk => {
        stdoutData += chunk;
      });

      child.stderr.on('data', chunk => {
        stderrData += chunk;
      });

      child.on('error', err => {
        clearTimeout(timeout);
        reject(new Error(`Không thể khởi chạy yt-dlp: ${err.message}`));
      });

      child.on('close', code => {
        clearTimeout(timeout);
        if (code !== 0) {
          if (stderrData.includes('Sign in to confirm') || stderrData.includes('bot')) {
            return reject(new Error('YouTube yêu cầu xác minh tài khoản / chặn bot. Hãy cấu hình cookies.txt để tiếp tục.'));
          }
          if (stderrData.includes('Video unavailable') || stderrData.includes('Private video')) {
            return reject(new Error('Video không khả dụng hoặc ở chế độ riêng tư.'));
          }
          return reject(new Error(`yt-dlp lỗi (code ${code}): ${stderrData.slice(0, 300)}`));
        }

        try {
          const json = JSON.parse(stdoutData);
          resolve(json);
        } catch (e) {
          reject(new Error(`Lỗi phân tích JSON từ yt-dlp: ${e.message}`));
        }
      });
    });
  }

  /**
   * Tạo tiến trình stream tải video/audio trực tiếp từ yt-dlp
   * @param {string} url 
   * @param {string} format 
   * @param {object} headers 
   * @returns {import('node:child_process').ChildProcessWithoutNullStreams}
   */
  spawnStream(url, format = 'best', headers = {}) {
    const args = [
      '-f', format,
      '-o', '-',
      '--no-playlist',
      '--no-warnings',
      '--no-part',
      url
    ];

    if (this.hasValidCookiesFile()) {
      args.unshift('--cookies', config.cookiesPath);
    }

    for (const [key, val] of Object.entries(headers)) {
      args.push('--add-header', `${key}:${val}`);
    }

    return spawn(this.getExecutable(), args);
  }
}

export const ytdlpService = new YtdlpService();


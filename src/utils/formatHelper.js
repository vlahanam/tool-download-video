/**
 * Chuyển số giây sang định dạng mm:ss hoặc hh:mm:ss
 * @param {number} seconds 
 * @returns {string}
 */
export function formatDuration(seconds) {
  if (!seconds || isNaN(seconds) || seconds < 0) return '00:00';
  const sec = Math.floor(seconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/**
 * Chuyển bytes sang KB, MB, GB dễ đọc
 * @param {number} bytes 
 * @returns {string}
 */
export function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes) || bytes <= 0) return 'Không rõ';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Làm sạch tên file và tạo Content-Disposition header an toàn
 * @param {string} rawTitle 
 * @param {string} ext 
 * @returns {{ asciiFilename: string, contentDisposition: string }}
 */
export function getSafeContentDisposition(rawTitle, ext = 'mp4') {
  const safeExt = ext.replace(/^\./, '').toLowerCase() || 'mp4';
  const cleanTitle = (rawTitle || 'video')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim() || 'video';

  // ASCII fallback name
  const asciiTitle = cleanTitle
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s.-]/g, '')
    .trim() || 'media';

  const asciiFilename = `${asciiTitle}.${safeExt}`;
  const utf8Filename = `${cleanTitle}.${safeExt}`;
  const encodedUtf8 = encodeURIComponent(utf8Filename);

  const contentDisposition = `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodedUtf8}`;

  return {
    asciiFilename,
    utf8Filename,
    contentDisposition
  };
}

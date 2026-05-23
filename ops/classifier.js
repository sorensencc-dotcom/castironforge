// file: src/lib/classifier.js
// created: 2026-05-03
// updated: 2026-05-03
// version: 1.0.0
// Maps file extensions to CIC canonical categories.
// Rule: extension determines category unless overridden. Ambiguous → 'documents'.

/** @type {Record<string, string>} */
const EXT_MAP = {
  // photos
  '.jpg':  'photos',
  '.jpeg': 'photos',
  '.png':  'photos',
  '.tiff': 'photos',
  '.tif':  'photos',
  '.heic': 'photos',
  '.heif': 'photos',
  '.raw':  'photos',
  '.cr2':  'photos',
  '.nef':  'photos',
  '.webp': 'photos',
  '.bmp':  'photos',
  '.gif':  'photos',  // treat as photo (static frame)

  // documents
  '.pdf':  'documents',
  '.doc':  'documents',
  '.docx': 'documents',
  '.txt':  'documents',
  '.rtf':  'documents',
  '.odt':  'documents',
  '.html': 'documents',
  '.htm':  'documents',
  '.xml':  'documents',
  '.csv':  'documents',
  '.xls':  'documents',
  '.xlsx': 'documents',
  '.ppt':  'documents',
  '.pptx': 'documents',
  '.epub': 'documents',
  '.mobi': 'documents',

  // audio
  '.mp3':  'audio',
  '.wav':  'audio',
  '.m4a':  'audio',
  '.aac':  'audio',
  '.ogg':  'audio',
  '.flac': 'audio',
  '.wma':  'audio',
  '.aiff': 'audio',
  '.aif':  'audio',

  // video
  '.mp4':  'video',
  '.mov':  'video',
  '.avi':  'video',
  '.mkv':  'video',
  '.wmv':  'video',
  '.m4v':  'video',
  '.webm': 'video',
  '.mpg':  'video',
  '.mpeg': 'video',
  '.flv':  'video',

  // notes
  '.md':   'notes',
  '.mdx':  'notes',
  '.org':  'notes',
  '.rst':  'notes',
  '.json': 'notes',  // research notes / structured data
  '.yaml': 'notes',
  '.yml':  'notes',
};

const VALID_CATEGORIES = new Set(['photos', 'documents', 'audio', 'video', 'notes']);

/**
 * Classify a file by its extension.
 * @param {string} filename - File name or full path.
 * @param {string} [override] - Explicit category override (must be valid).
 * @returns {string} - One of: photos | documents | audio | video | notes
 */
export function classify(filename, override) {
  if (override) {
    if (!VALID_CATEGORIES.has(override)) {
      throw new Error(`classifier: invalid override category "${override}"`);
    }
    return override;
  }

  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  return EXT_MAP[ext] ?? 'documents';
}

/**
 * Return the MIME type hint for an extension (best-effort).
 * @param {string} filename
 * @returns {string}
 */
export function mimeHint(filename) {
  const ext = filename.slice(filename.lastIndexOf('.')).toLowerCase();
  const MIME = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.tiff': 'image/tiff', '.tif': 'image/tiff', '.heic': 'image/heic',
    '.pdf': 'application/pdf', '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain', '.html': 'text/html', '.md': 'text/markdown',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
    '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.avi': 'video/x-msvideo',
    '.csv': 'text/csv', '.json': 'application/json',
  };
  return MIME[ext] ?? 'application/octet-stream';
}

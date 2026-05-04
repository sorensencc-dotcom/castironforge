// file: src/mover/classifier.js
// Simple deterministic file classifier by extension and mime-type.

import { extname } from 'node:path';

const EXT_CLASS_MAP = {
  // documents
  '.doc': 'documents', '.docx': 'documents', '.pdf': 'documents', '.txt': 'documents', '.rtf': 'documents',
  // photos
  '.jpg': 'photos', '.jpeg': 'photos', '.png': 'photos', '.tif': 'photos', '.tiff': 'photos', '.gif': 'photos',
  // audio
  '.mp3': 'audio', '.wav': 'audio', '.m4a': 'audio', '.flac': 'audio',
  // video
  '.mp4': 'video', '.mov': 'video', '.avi': 'video', '.mkv': 'video',
  // notes / misc
  '.md': 'notes', '.html': 'notes'
};

export function classifyByExtension(filename, mimeType = '') {
  const ext = extname(filename || '').toLowerCase();
  if (ext && EXT_CLASS_MAP[ext]) return EXT_CLASS_MAP[ext];

  // fallback by mime type prefixes
  if (mimeType.startsWith('image/')) return 'photos';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.includes('pdf') || mimeType.includes('msword')) return 'documents';

  // default
  return 'notes';
}

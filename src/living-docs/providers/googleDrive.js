// File: src/living-docs/providers/googleDrive.js | Date: 2026-05-18 | v1.0.0
import { google } from 'googleapis';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load secrets from the known location in integrations
const SECRETS_PATH = join(__dirname, '../../../integrations/google-drive-mcp/config/secrets/.env');
dotenv.config({ path: SECRETS_PATH });

/**
 * @returns {import('googleapis').Auth.OAuth2Client}
 */
function getOAuth2Client() {
  const {
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GOOGLE_REFRESH_TOKEN,
  } = process.env;

  const oAuth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  oAuth2Client.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
  return oAuth2Client;
}

const drive = google.drive({ version: 'v3', auth: getOAuth2Client() });

/**
 * Fetches a document from Google Drive.
 * @param {string} remoteId 
 * @returns {Promise<import('../types').RemoteDoc>}
 */
export async function fetchDoc(remoteId) {
  try {
    // 1. Get metadata (modifiedTime, md5Checksum)
    const meta = await drive.files.get({
      fileId: remoteId,
      fields: 'id, name, modifiedTime, md5Checksum, mimeType',
    });

    // 2. Get content
    // If it's a Google Doc, we export it as markdown/text. 
    // If it's a regular file (like TREATMENT.md), we get alt=media.
    let content = '';
    if (meta.data.mimeType === 'application/vnd.google-apps.document') {
      const res = await drive.files.export({
        fileId: remoteId,
        mimeType: 'text/plain',
      });
      content = res.data;
    } else {
      const res = await drive.files.get({
        fileId: remoteId,
        alt: 'media',
      });
      content = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
    }

    return {
      exists: true,
      content,
      hash: meta.data.md5Checksum || null,
      lastModifiedAt: meta.data.modifiedTime || null,
    };
  } catch (err) {
    if (err.code === 404) {
      return { exists: false, content: null, hash: null, lastModifiedAt: null };
    }
    throw err;
  }
}

/**
 * Updates a document on Google Drive.
 * @param {string} remoteId 
 * @param {string} content 
 * @returns {Promise<import('../types').RemoteDoc>}
 */
export async function updateDoc(remoteId, content) {
  const res = await drive.files.update({
    fileId: remoteId,
    media: {
      mimeType: 'text/markdown',
      body: content,
    },
    fields: 'id, name, modifiedTime, md5Checksum',
  });

  return {
    exists: true,
    content,
    hash: res.data.md5Checksum || null,
    lastModifiedAt: res.data.modifiedTime || null,
  };
}

// File: src/living-docs/providers/oneDrive.js | v1.0.0 | 2026-05-19
import { sha256 } from '../utils.js'
import { readFileSync } from 'node:fs'
import fetch from 'node-fetch'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ENV_PATH = join(__dirname, '../../../integrations/onedrive-mcp/config/secrets/.env')

// Manual env loader (no dotenv dependency)
const env = Object.fromEntries(
  readFileSync(ENV_PATH, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(line => line.split('=').map(s => s.trim()))
)

const {
  ONEDRIVE_CLIENT_ID,
  ONEDRIVE_CLIENT_SECRET,
  ONEDRIVE_REFRESH_TOKEN,
  ONEDRIVE_TENANT_ID
} = env

async function getAccessToken() {
  const url = `https://login.microsoftonline.com/${ONEDRIVE_TENANT_ID}/oauth2/v2.0/token`

  const params = new URLSearchParams()
  params.append('client_id', ONEDRIVE_CLIENT_ID)
  params.append('client_secret', ONEDRIVE_CLIENT_SECRET)
  params.append('refresh_token', ONEDRIVE_REFRESH_TOKEN)
  params.append('grant_type', 'refresh_token')
  params.append('scope', 'https://graph.microsoft.com/.default')

  const res = await fetch(url, { method: 'POST', body: params })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OneDrive token refresh failed: ${text}`)
  }

  const json = await res.json()
  return json.access_token
}

async function fetchDoc(remoteId) {
  const token = await getAccessToken()

  // Path-based resolution
  const url = `https://graph.microsoft.com/v1.0/me/drive/root:${remoteId}:/content`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` }
  })

  if (res.status === 404) {
    return { exists: false, content: null, hash: null }
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OneDrive fetch failed: ${text}`)
  }

  const content = await res.text()
  return {
    exists: true,
    content,
    hash: sha256(content)
  }
}

async function updateDoc(remoteId, content) {
  const token = await getAccessToken()

  const url = `https://graph.microsoft.com/v1.0/me/drive/root:${remoteId}:/content`

  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'text/plain'
    },
    body: content
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OneDrive update failed: ${text}`)
  }

  return {
    hash: sha256(content)
  }
}

export {
  fetchDoc,
  updateDoc
}

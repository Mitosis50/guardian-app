/**
 * recovery.js — Agent Guardian File Recovery
 *
 * Downloads encrypted backups from IPFS and decrypts them locally.
 * Used by the "Recover Files" panel in the Settings window.
 */

'use strict'

const https    = require('https')
const http     = require('http')
const fs       = require('fs/promises')
const path     = require('path')
const os       = require('os')
const { decryptFile } = require('./decrypt')

const API_BASE = 'https://beneficial-commitment-production-4481.up.railway.app'

const IPFS_GATEWAYS = [
  'https://gateway.pinata.cloud/ipfs/',
  'https://ipfs.io/ipfs/',
  'https://dweb.link/ipfs/',
]

// ─── HTTP Helpers ─────────────────────────────────────────────────────────────

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, (res) => {
      let body = ''
      res.on('data', d => { body += d })
      res.on('end', () => {
        try { resolve(JSON.parse(body)) }
        catch (e) { reject(new Error(`Invalid JSON from ${url}: ${body.slice(0, 200)}`)) }
      })
    }).on('error', reject)
  })
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    client.get(url, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`))
      }
      const chunks = []
      res.on('data', d => chunks.push(d))
      res.on('end', async () => {
        await fs.writeFile(destPath, Buffer.concat(chunks))
        resolve(destPath)
      })
    }).on('error', reject)
  })
}

async function downloadFromIPFS(cid, destPath) {
  let lastError
  for (const gateway of IPFS_GATEWAYS) {
    try {
      await downloadFile(`${gateway}${cid}`, destPath)
      return destPath
    } catch (err) {
      lastError = err
      console.warn(`[guardian] IPFS gateway failed (${gateway}): ${err.message}`)
    }
  }
  throw new Error(`All IPFS gateways failed for CID ${cid}. Last error: ${lastError.message}`)
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Fetch all non-deleted backups for an email from the Guardian API.
 * Returns array sorted newest-first.
 */
async function listBackups(email) {
  if (!email) throw new Error('Email is required to list backups.')
  const url = `${API_BASE}/api/agents/${encodeURIComponent(email)}`
  const json = await fetchJson(url)
  if (!json.ok) throw new Error(json.error || 'API request failed')
  // Sort newest first
  const data = (json.data || []).sort((a, b) =>
    new Date(b.created_at) - new Date(a.created_at)
  )
  return data
}

/**
 * Get the most recent backup for each sacred filename.
 * Returns a Map: filename → backup record
 */
async function latestBackupsPerFile(email) {
  const all = await listBackups(email)
  const latest = new Map()
  for (const record of all) {
    if (!latest.has(record.filename)) {
      latest.set(record.filename, record)
    }
  }
  return latest
}

// ─── Recovery ─────────────────────────────────────────────────────────────────

/**
 * Recover a single file by CID.
 *
 * @param {object} opts
 * @param {string} opts.cid           IPFS CID
 * @param {string} opts.filename      Original filename (e.g. "MEMORY.md")
 * @param {string} opts.keyPath       Path to ~/.guardian-key
 * @param {string} opts.outputDir     Directory to write recovered file into
 * @param {function} opts.onProgress  Optional progress callback (message string)
 * @returns {Promise<string>}         Resolved output path
 */
async function recoverOne({ cid, filename, keyPath, outputDir, onProgress }) {
  const emit = onProgress || (() => {})

  // Determine clean output filename (strip timestamp prefix if present)
  // e.g. "1714318886000-MEMORY.md.enc" → "MEMORY.md"
  //      "MEMORY.md.encrypted"         → "MEMORY.md"
  //      "MEMORY.md"                   → "MEMORY.md"
  const cleanName = filename
    .replace(/^\d+-/, '')           // strip leading timestamp
    .replace(/\.enc$/, '')          // strip .enc
    .replace(/\.encrypted$/, '')    // strip .encrypted

  await fs.mkdir(outputDir, { recursive: true })
  const tempEnc = path.join(os.tmpdir(), `guardian-recover-${Date.now()}-${cleanName}.enc`)
  const outPath = path.join(outputDir, cleanName)

  try {
    emit(`↓ Downloading ${cleanName}…`)
    await downloadFromIPFS(cid, tempEnc)

    emit(`🔓 Decrypting ${cleanName}…`)
    await decryptFile(tempEnc, keyPath, outPath)

    emit(`✅ ${cleanName} recovered`)
    return outPath
  } finally {
    await fs.unlink(tempEnc).catch(() => {})
  }
}

/**
 * Recover ALL files (latest version of each) for a user.
 *
 * @param {object} opts
 * @param {string} opts.email         User email
 * @param {string} opts.keyPath       Path to ~/.guardian-key
 * @param {string} opts.outputDir     Where to write recovered files
 * @param {function} opts.onProgress  Progress callback (message string)
 * @returns {Promise<{recovered: string[], failed: Array<{filename, error}>}>}
 */
async function recoverAll({ email, keyPath, outputDir, onProgress }) {
  const emit = onProgress || (() => {})

  emit('Fetching your backup list…')
  const latest = await latestBackupsPerFile(email)

  if (latest.size === 0) {
    emit('No backups found for this email.')
    return { recovered: [], failed: [] }
  }

  emit(`Found ${latest.size} file(s) to recover.`)

  const recovered = []
  const failed    = []

  for (const [filename, record] of latest.entries()) {
    try {
      const outPath = await recoverOne({
        cid: record.cid,
        filename,
        keyPath,
        outputDir,
        onProgress: emit,
      })
      recovered.push(outPath)
    } catch (err) {
      console.error(`[guardian] recovery failed for ${filename}:`, err.message)
      failed.push({ filename, error: err.message })
      emit(`❌ ${filename}: ${err.message}`)
    }
  }

  return { recovered, failed }
}

module.exports = { listBackups, latestBackupsPerFile, recoverOne, recoverAll }

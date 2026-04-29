/**
 * decrypt.js — Agent Guardian File Recovery
 *
 * Decrypts any .enc file produced by Agent Guardian.
 *
 * Encryption format (written by encryptFile):
 *   [0..5]   MAGIC     6 bytes  "AGGCM1"
 *   [6..17]  IV        12 bytes AES-GCM nonce
 *   [18..33] AUTH TAG  16 bytes GCM authentication tag
 *   [34..]   CIPHERTEXT         AES-256-GCM encrypted payload
 *
 * The 32-byte key is read from ~/.guardian-key (hex string, 64 chars).
 */

'use strict'

const crypto = require('crypto')
const fs     = require('fs/promises')
const path   = require('path')
const os     = require('os')

const MAGIC        = Buffer.from('AGGCM1')
const MAGIC_LEN    = 6
const IV_LEN       = 12
const AUTH_TAG_LEN = 16
const HEADER_LEN   = MAGIC_LEN + IV_LEN + AUTH_TAG_LEN   // 34 bytes

// ─── Key Loading ─────────────────────────────────────────────────────────────

async function loadKey(keyPath) {
  const resolved = keyPath
    ? keyPath.replace(/^~/, os.homedir())
    : path.join(os.homedir(), '.guardian-key')

  let raw
  try {
    raw = await fs.readFile(resolved)
  } catch (err) {
    throw new Error(
      `Cannot read encryption key at "${resolved}": ${err.message}\n` +
      'Ensure ~/.guardian-key exists and you have read permission.'
    )
  }

  const text = raw.toString('utf8').trim()
  if (/^[a-f0-9]{64}$/i.test(text)) {
    return Buffer.from(text, 'hex')
  }
  if (raw.length >= 32) {
    return raw.subarray(0, 32)
  }
  throw new Error(
    `Key file "${resolved}" is invalid — expected a 64-char hex string or ≥32 raw bytes.`
  )
}

// ─── Decrypt ─────────────────────────────────────────────────────────────────

/**
 * Decrypts a Buffer produced by encryptBuffer().
 * @param {Buffer} encrypted  Full .enc file contents
 * @param {Buffer} key        32-byte AES key
 * @returns {Buffer}          Original plaintext
 */
function decryptBuffer(encrypted, key) {
  // Validate magic header
  const magic = encrypted.subarray(0, MAGIC_LEN)
  if (!magic.equals(MAGIC)) {
    throw new Error(
      'Not a valid Agent Guardian file — magic header "AGGCM1" not found.\n' +
      'Make sure you are decrypting a .enc file created by Agent Guardian.'
    )
  }

  if (encrypted.length < HEADER_LEN) {
    throw new Error(`File too short (${encrypted.length} bytes) — corrupted or incomplete.`)
  }

  const iv      = encrypted.subarray(MAGIC_LEN, MAGIC_LEN + IV_LEN)
  const authTag = encrypted.subarray(MAGIC_LEN + IV_LEN, HEADER_LEN)
  const data    = encrypted.subarray(HEADER_LEN)

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)

  try {
    return Buffer.concat([decipher.update(data), decipher.final()])
  } catch (err) {
    throw new Error(
      'Decryption failed — authentication tag mismatch.\n' +
      'Possible causes:\n' +
      '  • Wrong encryption key (key was rotated or you are using a different machine)\n' +
      '  • File was corrupted during download or transfer\n' +
      '  • File was not encrypted by Agent Guardian'
    )
  }
}

/**
 * Decrypt a .enc file and write the result next to it (or to outputPath).
 *
 * @param {string} encFilePath   Path to the .enc file
 * @param {string} [keyPath]     Path to ~/.guardian-key (default: ~/.guardian-key)
 * @param {string} [outputPath]  Where to write decrypted output (default: strip .enc suffix)
 * @returns {Promise<string>}    Resolved output path
 */
async function decryptFile(encFilePath, keyPath, outputPath) {
  const key       = await loadKey(keyPath)
  const encrypted = await fs.readFile(encFilePath)
  const plaintext = decryptBuffer(encrypted, key)

  // Determine output path
  if (!outputPath) {
    // Strip trailing .enc — e.g. "1234567890-MEMORY.md.enc" → "1234567890-MEMORY.md"
    outputPath = encFilePath.endsWith('.enc')
      ? encFilePath.slice(0, -4)
      : `${encFilePath}.decrypted`
  }

  await fs.writeFile(outputPath, plaintext)
  return outputPath
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Agent Guardian — File Recovery Tool
────────────────────────────────────
Usage:
  node lib/decrypt.js <file.enc> [--key <path>] [--out <path>]

Arguments:
  <file.enc>        Path to the encrypted .enc file to recover
  --key <path>      Path to your encryption key (default: ~/.guardian-key)
  --out <path>      Where to write the decrypted file (default: strips .enc)

Examples:
  # Recover MEMORY.md from a local .enc file
  node lib/decrypt.js ~/.guardian-queue/1234567890-MEMORY.md.enc

  # Recover with explicit key path
  node lib/decrypt.js backup.enc --key /Volumes/USB/guardian-key.txt

  # Recover to a specific output file
  node lib/decrypt.js backup.enc --out ~/recovered/MEMORY.md

  # Recover from IPFS (download first, then decrypt)
  curl -o backup.enc "https://gateway.pinata.cloud/ipfs/<CID>"
  node lib/decrypt.js backup.enc

Exit codes: 0 = success, 1 = error
`)
    process.exit(0)
  }

  // Parse args
  let encFilePath = null
  let keyPath     = null
  let outputPath  = null

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--key' && args[i + 1]) { keyPath    = args[++i] }
    else if (args[i] === '--out' && args[i + 1]) { outputPath = args[++i] }
    else if (!args[i].startsWith('--'))          { encFilePath = args[i] }
  }

  if (!encFilePath) {
    console.error('Error: no .enc file specified. Run with --help for usage.')
    process.exit(1)
  }

  try {
    const out = await decryptFile(encFilePath, keyPath, outputPath)
    console.log(`✅ Decrypted successfully → ${out}`)
    process.exit(0)
  } catch (err) {
    console.error(`\n❌ Recovery failed:\n   ${err.message}\n`)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { decryptBuffer, decryptFile, loadKey }

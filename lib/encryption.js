const crypto = require('crypto')
const fs = require('fs/promises')
const path = require('path')
const os = require('os')

const MAGIC = Buffer.from('AGGCM1')

async function ensureKey(keyPath) {
  if (!keyPath) throw new Error('Encryption key path is required')

  try {
    const existing = await fs.readFile(keyPath)
    const asText = existing.toString('utf8').trim()

    if (/^[a-f0-9]{64}$/i.test(asText)) {
      return Buffer.from(asText, 'hex')
    }

    if (existing.length >= 32) {
      return existing.subarray(0, 32)
    }
  } catch (_) {
    // Create below when missing.
  }

  await fs.mkdir(path.dirname(keyPath), { recursive: true })
  const key = crypto.randomBytes(32)
  await fs.writeFile(keyPath, `${key.toString('hex')}\n`, { mode: 0o600 })
  return key
}

async function encryptBuffer(buffer, key) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([MAGIC, iv, tag, encrypted])
}

async function encryptFile(filePath, keyPath) {
  const key = await ensureKey(keyPath)
  const input = await fs.readFile(filePath)
  const encrypted = await encryptBuffer(input, key)
  const queueDir = path.join(os.homedir(), '.guardian-queue')
  await fs.mkdir(queueDir, { recursive: true })
  const safeName = path.basename(filePath).replace(/[^a-z0-9._-]/gi, '_')
  const outputPath = path.join(queueDir, `${Date.now()}-${safeName}.enc`)
  await fs.writeFile(outputPath, encrypted, { mode: 0o600 })
  return { outputPath }
}

module.exports = { ensureKey, encryptBuffer, encryptFile }

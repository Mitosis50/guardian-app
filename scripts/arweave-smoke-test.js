#!/usr/bin/env node
/**
 * scripts/arweave-smoke-test.js — Arweave Smoke Test
 *
 * Creates a tiny synthetic file, encrypts it, uploads to Arweave,
 * waits for confirmation, downloads, decrypts, and verifies byte-for-byte
 * equality.
 *
 * Requires:
 *   ARWEAVE_KEYFILE (preferred) or ARWEAVE_WALLET_PATH (legacy alias)
 *   — path to a funded Arweave JWK wallet file
 * Optional env:
 *   ARWEAVE_HOST        — default: arweave.net
 *   ARWEAVE_PORT        — default: 443
 *   ARWEAVE_PROTOCOL    — default: https
 *
 * Usage:
 *   ARWEAVE_KEYFILE=~/.arweave-wallet.json node scripts/arweave-smoke-test.js
 *
 * Secret redaction: wallet contents and private keys are never logged.
 */

'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const os = require('os')

const { encryptBuffer } = require('../lib/encryption')
const { decryptBuffer } = require('../lib/decrypt')
const { ArweaveProvider } = require('../lib/storage/arweave-provider')
const { downloadTransaction } = require('../lib/arweave-gateway')

const WALLET_PATH = process.env.ARWEAVE_KEYFILE || process.env.ARWEAVE_WALLET_PATH || ''
const HOST = process.env.ARWEAVE_HOST || 'arweave.net'
const PORT = Number(process.env.ARWEAVE_PORT || 443)
const PROTOCOL = process.env.ARWEAVE_PROTOCOL || 'https'

function redact(s) {
  if (!s || typeof s !== 'string') return '[empty]'
  if (s.length <= 12) return '***'
  return s.slice(0, 4) + '...' + s.slice(-4)
}

function assertEqualBuffers(a, b, label) {
  if (a.length !== b.length) {
    throw new Error(`${label}: length mismatch (${a.length} vs ${b.length})`)
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      throw new Error(`${label}: byte mismatch at offset ${i}`)
    }
  }
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log('\n─── Agent Guardian Arweave Smoke Test ───\n')

  let tmpDir = null

  // Credential check
  if (!WALLET_PATH) {
    console.error('❌ ARWEAVE_KEYFILE (or ARWEAVE_WALLET_PATH) is not set.')
    console.error('   Export the path to your Arweave JWK wallet file and re-run.')
    console.error('   Example: ARWEAVE_KEYFILE=~/.arweave-wallet.json node scripts/arweave-smoke-test.js')
    process.exit(1)
  }

  const resolvedWallet = WALLET_PATH.replace(/^~(?=\/|$)/, os.homedir())
  if (!fs.existsSync(resolvedWallet)) {
    console.error(`❌ Wallet file not found: ${resolvedWallet}`)
    process.exit(1)
  }

  console.log(`Wallet path: ${resolvedWallet}`)
  console.log(`Gateway:     ${PROTOCOL}://${HOST}:${PORT}`)
  console.log('')

  // Setup temp workspace
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-arweave-smoke-'))

  try {
    const key = crypto.randomBytes(32)
    const keyPath = path.join(tmpDir, 'guardian-key')
    fs.writeFileSync(keyPath, key.toString('hex') + '\n')

    // 1. Synthetic plaintext
    const plaintext = Buffer.from(
      `Agent Guardian Arweave Smoke Test\nTimestamp: ${Date.now()}\nEntropy: ${crypto.randomBytes(32).toString('base64')}`
    )
    console.log(`[1/6] plaintext: ${plaintext.length} bytes`)

    // 2. Encrypt
    const encrypted = await encryptBuffer(plaintext, key)
    const encPath = path.join(tmpDir, 'smoke-test.enc')
    fs.writeFileSync(encPath, encrypted)
    console.log(`[2/6] encrypted: ${encrypted.length} bytes`)

    // 3. Upload
    const provider = new ArweaveProvider({
      walletPath: resolvedWallet,
      host: HOST,
      port: PORT,
      protocol: PROTOCOL,
      timeoutMs: 120000
    })

    let uploadResult
    try {
      uploadResult = await provider.upload(encPath, 'smoke-test.txt')
    } catch (err) {
      console.error(`[3/6] ❌ Upload failed: ${err.message}`)
      if (/insufficient|balance|funds/i.test(err.message)) {
        console.error('   Your wallet may not have enough AR to pay the transaction fee.')
      }
      throw new Error('Arweave upload failed')
    }

    console.log(`[3/6] uploaded → txId: ${redact(uploadResult.id)}`)
    console.log(`      url: ${uploadResult.url}`)

    // 4. Wait for confirmation (poll)
    console.log('[4/6] polling for confirmation…')
    let confirmed = false
    let attempts = 0
    const maxAttempts = 30
    while (!confirmed && attempts < maxAttempts) {
      await sleep(5000)
      attempts++
      const status = await provider.getStatus(uploadResult.id)
      console.log(`      attempt ${attempts}/${maxAttempts}: ${status.status}`)
      if (status.ok) {
        confirmed = true
      }
    }

    if (!confirmed) {
      console.error('[4/6] ❌ Transaction did not confirm within the polling window.')
      console.error(`      You can still check status manually at: ${uploadResult.url}`)
      throw new Error('Arweave transaction did not confirm within polling window')
    }

    // 5. Download
    console.log('[5/6] downloading from gateway…')
    let retrieved
    try {
      retrieved = await downloadTransaction(uploadResult.id, {
        gateways: [`${PROTOCOL}://${HOST}`],
        timeoutMs: 60000
      })
    } catch (err) {
      console.error(`[5/6] ❌ Download failed: ${err.message}`)
      throw new Error('Arweave download failed')
    }
    console.log(`[5/6] retrieved: ${retrieved.length} bytes`)

    // 6. Decrypt + compare
    console.log('[6/6] decrypting & comparing…')
    const decrypted = decryptBuffer(retrieved, key)
    assertEqualBuffers(decrypted, plaintext, 'decrypted vs original')
    console.log('[6/6] ✅ byte-for-byte match confirmed')

    console.log('\n✅ SMOKE TEST PASSED')
    console.log(`   txId: ${uploadResult.id}`)
    console.log(`   url:  ${uploadResult.url}`)
  } finally {
    if (tmpDir) {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      } catch (_) {
        // Best-effort cleanup; do not let cleanup failures mask real errors.
      }
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('\n❌ UNEXPECTED ERROR:', err.message)
    process.exit(1)
  })
}

/**
 * tests/arweave-integration.test.js — End-to-end mock Arweave round-trip
 *
 * Simulates:
 *   1. Create synthetic plaintext
 *   2. Encrypt with AES-256-GCM
 *   3. Mock Arweave upload (in-memory)
 *   4. Retrieve from mock gateway
 *   5. Decrypt
 *   6. Byte-for-byte compare
 *
 * Run: node tests/arweave-integration.test.js
 * Or:  npm run test:arweave
 */

'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const os = require('os')

const { encryptBuffer } = require('../lib/encryption')
const { decryptBuffer } = require('../lib/decrypt')
const { downloadTransaction } = require('../lib/arweave-gateway')

// ─── Mock Arweave Provider for Integration ───────────────────────────────────

class MockArweaveProvider {
  constructor() {
    this.name = 'arweave'
    this.storage = new Map() // txId → Buffer
    this._nextId = 1
  }

  async isAvailable() {
    return true
  }

  async upload(filePath) {
    const data = fs.readFileSync(filePath)
    const txId = `mock-tx-${String(this._nextId++).padStart(6, '0')}`
    this.storage.set(txId, data)
    return { id: txId, url: `https://mock-arweave.net/${txId}` }
  }

  async getStatus(txId) {
    const exists = this.storage.has(txId)
    return { ok: exists, status: exists ? 'confirmed' : 'not-found', confirmations: exists ? 10 : 0 }
  }

  getGatewayUrl(txId) {
    return `https://mock-arweave.net/${txId}`
  }
}

// ─── Mock Gateway Download ───────────────────────────────────────────────────

// Replace the real downloadTransaction with one that reads from our mock store.
function createMockDownloader(provider) {
  return async function mockDownload(txId) {
    if (!provider.storage.has(txId)) {
      throw new Error(`Transaction ${txId} not found in mock store`)
    }
    return Buffer.from(provider.storage.get(txId))
  }
}

// ─── Test Harness ────────────────────────────────────────────────────────────

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

async function runTest() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-arweave-test-'))
  const key = crypto.randomBytes(32)
  const keyPath = path.join(tmpDir, 'guardian-key')
  fs.writeFileSync(keyPath, key.toString('hex') + '\n')

  // 1. Synthetic plaintext
  const plaintext = Buffer.from(
    `Agent Guardian Arweave Integration Test\nTimestamp: ${Date.now()}\nEntropy: ${crypto.randomBytes(64).toString('base64')}`
  )
  console.log(`[test] plaintext size: ${plaintext.length} bytes`)

  // 2. Encrypt
  const encrypted = await encryptBuffer(plaintext, key)
  const encPath = path.join(tmpDir, 'test-backup.enc')
  fs.writeFileSync(encPath, encrypted)
  console.log(`[test] encrypted size: ${encrypted.length} bytes`)

  // 3. Mock Arweave upload
  const mockProvider = new MockArweaveProvider()
  const uploadResult = await mockProvider.upload(encPath)
  console.log(`[test] mock upload txId: ${uploadResult.id}`)

  // 4. Verify status
  const status = await mockProvider.getStatus(uploadResult.id)
  console.log(`[test] mock status: ${status.status} (confirmations: ${status.confirmations})`)
  if (!status.ok) {
    throw new Error('Mock status should be ok after upload')
  }

  // 5. Retrieve from mock gateway
  const mockDownload = createMockDownloader(mockProvider)
  const retrieved = await mockDownload(uploadResult.id)
  console.log(`[test] retrieved size: ${retrieved.length} bytes`)

  // 6. Decrypt
  const decrypted = decryptBuffer(retrieved, key)
  console.log(`[test] decrypted size: ${decrypted.length} bytes`)

  // 7. Byte-for-byte compare
  assertEqualBuffers(decrypted, plaintext, 'decrypted vs plaintext')
  console.log('[test] ✅ byte-for-byte match confirmed')

  // Cleanup
  fs.rmSync(tmpDir, { recursive: true, force: true })
  console.log('[test] cleanup complete')

  return { passed: true, txId: uploadResult.id }
}

async function runFailureTest() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-arweave-fail-'))
  const key = crypto.randomBytes(32)
  const plaintext = Buffer.from('sensitive data that must not leak')
  const encrypted = await encryptBuffer(plaintext, key)
  const encPath = path.join(tmpDir, 'test-backup.enc')
  fs.writeFileSync(encPath, encrypted)

  const mockProvider = new MockArweaveProvider()
  const uploadResult = await mockProvider.upload(encPath)

  // Corrupt the stored payload (simulate tampered gateway response)
  // Header is 34 bytes; corrupt ciphertext after header so magic passes but auth tag fails.
  const stored = mockProvider.storage.get(uploadResult.id)
  const corrupted = Buffer.concat([
    stored.slice(0, 40),
    Buffer.from('GARBAGE'),
    stored.slice(47)
  ])
  mockProvider.storage.set(uploadResult.id, corrupted)

  const mockDownload = createMockDownloader(mockProvider)
  const retrieved = await mockDownload(uploadResult.id)

  try {
    decryptBuffer(retrieved, key)
    throw new Error('Should have thrown authentication tag mismatch')
  } catch (err) {
    if (!err.message.includes('authentication tag mismatch')) {
      throw err
    }
    console.log('[test] ✅ tampered payload correctly rejected by GCM auth tag')
  }

  fs.rmSync(tmpDir, { recursive: true, force: true })
  return { passed: true }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n─── Agent Guardian Arweave Mock Integration Test ───\n')

  try {
    const result = await runTest()
    await runFailureTest()
    console.log('\n✅ ALL TESTS PASSED')
    console.log(`   txId: ${result.txId}`)
    process.exit(0)
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { runTest, runFailureTest, MockArweaveProvider }

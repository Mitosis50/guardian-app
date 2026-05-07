/**
 * tests/storage.test.js — Unit tests for storage providers
 *
 * Run: node --test tests/storage.test.js
 */

'use strict'

const { describe, it, before } = require('node:test')
const assert = require('node:assert')
const fs = require('fs')
const path = require('path')
const os = require('os')

const { StorageOrchestrator, PinataProvider, ArweaveProvider } = require('../lib/storage')

describe('PinataProvider', () => {
  it('reports unavailable when JWT is empty', async () => {
    const p = new PinataProvider('')
    assert.strictEqual(await p.isAvailable(), false)
  })

  it('reports available when JWT is present', async () => {
    const p = new PinataProvider('test-jwt')
    assert.strictEqual(await p.isAvailable(), true)
  })

  it('throws when file is missing', async () => {
    const p = new PinataProvider('test-jwt')
    await assert.rejects(
      p.upload('/nonexistent/path.enc', 'MEMORY.md'),
      /not found/
    )
  })
})

describe('ArweaveProvider', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-test-'))
  const fakeWalletPath = path.join(tmpDir, 'fake-wallet.json')

  before(() => {
    fs.writeFileSync(fakeWalletPath, JSON.stringify({ kty: 'RSA', n: 'abc123', d: 'def456' }))
  })

  it('reports unavailable when wallet path is empty', async () => {
    const p = new ArweaveProvider({})
    assert.strictEqual(await p.isAvailable(), false)
  })

  it('reports unavailable when wallet file is missing', async () => {
    const p = new ArweaveProvider({ walletPath: '/nonexistent/wallet.json' })
    assert.strictEqual(await p.isAvailable(), false)
  })

  it('reports available when wallet file exists and is valid JSON', async () => {
    const p = new ArweaveProvider({ walletPath: fakeWalletPath })
    assert.strictEqual(await p.isAvailable(), true)
  })

  it('throws when file is missing', async () => {
    const p = new ArweaveProvider({ walletPath: fakeWalletPath })
    await assert.rejects(
      p.upload('/nonexistent/path.enc', 'MEMORY.md'),
      /not found/
    )
  })

  it('throws when wallet file is invalid JSON', async () => {
    const badWallet = path.join(tmpDir, 'bad-wallet.json')
    fs.writeFileSync(badWallet, 'not-json')
    const p = new ArweaveProvider({ walletPath: badWallet })
    await assert.rejects(p._loadWallet(), /not valid JSON/)
  })
})

describe('StorageOrchestrator', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ag-test-'))
  const dummyEnc = path.join(tmpDir, 'dummy.enc')

  before(() => {
    fs.writeFileSync(dummyEnc, Buffer.from('encrypted-stub'))
  })

  it('throws when no providers are configured', async () => {
    const orchestrator = new StorageOrchestrator({})
    await assert.rejects(
      orchestrator.upload(dummyEnc, 'MEMORY.md'),
      /No storage providers/
    )
  })

  it('returns success for Pinata-only config', async () => {
    // We don't mock Pinata SDK here; this tests orchestrator wiring only.
    // Real Pinata upload is tested via integration or manually.
    const orchestrator = new StorageOrchestrator({ pinataJWT: 'test-jwt' })
    assert.strictEqual(orchestrator.providers.length, 1)
    assert.strictEqual(orchestrator.providers[0].name, 'ipfs')
  })

  it('includes Arweave provider when enabled and wallet present', async () => {
    const walletPath = path.join(tmpDir, 'wallet.json')
    fs.writeFileSync(walletPath, JSON.stringify({ kty: 'RSA' }))
    const orchestrator = new StorageOrchestrator({
      pinataJWT: 'test-jwt',
      arweaveEnabled: true,
      arweaveWalletPath: walletPath
    })
    assert.strictEqual(orchestrator.providers.length, 2)
    assert.deepStrictEqual(
      orchestrator.providers.map((p) => p.name),
      ['ipfs', 'arweave']
    )
  })

  it('omits Arweave provider when disabled even if wallet path exists', async () => {
    const walletPath = path.join(tmpDir, 'wallet.json')
    fs.writeFileSync(walletPath, JSON.stringify({ kty: 'RSA' }))
    const orchestrator = new StorageOrchestrator({
      pinataJWT: 'test-jwt',
      arweaveEnabled: false,
      arweaveWalletPath: walletPath
    })
    assert.strictEqual(orchestrator.providers.length, 1)
    assert.strictEqual(orchestrator.providers[0].name, 'ipfs')
  })
})

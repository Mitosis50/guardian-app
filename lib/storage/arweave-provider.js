/**
 * storage/arweave-provider.js — Arweave Archival Adapter
 *
 * Uploads encrypted backup payloads to Arweave as long-term archival storage.
 * Requires a funded wallet JWK. No plaintext ever leaves the device.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')
const { StorageProvider } = require('./base')

// Lazy-load arweave so the app can still start if the dep is tree-shaken out.
function getArweaveLib() {
  try {
    return require('arweave')
  } catch (_) {
    throw new Error('arweave npm package is required. Run: npm install arweave')
  }
}

class ArweaveProvider extends StorageProvider {
  constructor(options = {}) {
    super()
    this.walletPath = options.walletPath ? String(options.walletPath).trim() : ''
    this.host = options.host || 'arweave.net'
    this.port = options.port || 443
    this.protocol = options.protocol || 'https'
    this.timeoutMs = options.timeoutMs || 120000
    this._wallet = null
    this._arweave = null
  }

  get name() {
    return 'arweave'
  }

  _init() {
    if (this._arweave) return this._arweave
    const Arweave = getArweaveLib()
    this._arweave = Arweave.init({
      host: this.host,
      port: this.port,
      protocol: this.protocol,
      timeout: this.timeoutMs
    })
    return this._arweave
  }

  async _loadWallet() {
    if (this._wallet) return this._wallet
    if (!this.walletPath) {
      throw new Error('Arweave wallet path is not configured. Set ARWEAVE_KEYFILE (or ARWEAVE_WALLET_PATH) or config.arweaveWalletPath.')
    }

    const resolved = this.walletPath.replace(/^~(?=\/|$)/, os.homedir())
    let raw
    try {
      raw = await fs.promises.readFile(resolved, 'utf8')
    } catch (err) {
      throw new Error(`Cannot read Arweave wallet at "${resolved}": ${err.message}`)
    }

    let jwk
    try {
      jwk = JSON.parse(raw)
    } catch (err) {
      throw new Error(`Arweave wallet file is not valid JSON: ${err.message}`)
    }

    // Minimal sanity check for JWK shape (Arweave wallet keys have n, e, d, etc.)
    if (!jwk || typeof jwk !== 'object' || !jwk.kty) {
      throw new Error('Arweave wallet file does not appear to be a valid JWK.')
    }

    this._wallet = jwk
    return this._wallet
  }

  async isAvailable() {
    if (!this.walletPath) return false
    try {
      await this._loadWallet()
      return true
    } catch (_) {
      return false
    }
  }

  async upload(filePath, originalFileName) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Encrypted file not found: ${filePath}`)
    }

    const arweave = this._init()
    const wallet = await this._loadWallet()
    const data = await fs.promises.readFile(filePath)

    // Create transaction
    let transaction
    try {
      transaction = await arweave.createTransaction({ data }, wallet)
    } catch (err) {
      throw new Error(`Arweave transaction creation failed: ${err.message}`)
    }

    // Add tags so the payload is discoverable / self-describing
    transaction.addTag('App-Name', 'Agent Guardian')
    transaction.addTag('Content-Type', 'application/octet-stream')
    transaction.addTag('Original-File', String(originalFileName || path.basename(filePath)))

    // Sign
    try {
      await arweave.transactions.sign(transaction, wallet)
    } catch (err) {
      throw new Error(`Arweave transaction signing failed: ${err.message}`)
    }

    // Post
    let response
    try {
      response = await arweave.transactions.post(transaction)
    } catch (err) {
      throw new Error(`Arweave transaction post failed: ${err.message}`)
    }

    if (response.status !== 200 && response.status !== 202) {
      throw new Error(
        `Arweave transaction post rejected (HTTP ${response.status}): ${JSON.stringify(response.statusText || response.data)}`
      )
    }

    const txId = transaction.id
    if (!txId) {
      throw new Error('Arweave transaction was posted but no transaction id was returned.')
    }

    return {
      id: txId,
      url: `https://${this.host}/${txId}`
    }
  }

  async getStatus(txId) {
    const arweave = this._init()
    try {
      const status = await arweave.transactions.getStatus(txId)
      // status: { status: 200, confirmed: { block_height, block_indep_hash, number_of_confirmations } }
      const confirmed = status && status.confirmed
      const ok = Boolean(confirmed && confirmed.number_of_confirmations > 0)
      return {
        ok,
        status: ok ? `confirmed (${confirmed.number_of_confirmations} confirmations)` : 'pending',
        confirmations: confirmed ? confirmed.number_of_confirmations : 0
      }
    } catch (err) {
      return { ok: false, status: `error: ${err.message}`, confirmations: 0 }
    }
  }
}

module.exports = { ArweaveProvider }

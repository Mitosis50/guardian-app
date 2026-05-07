/**
 * storage/index.js — Storage Orchestrator
 *
 * Manages one or more StorageProvider instances.
 * Uploads to all configured providers; succeeds if at least one succeeds.
 * Falls back gracefully so that a failing optional provider does not break
 * the primary backup path.
 */

'use strict'

const { PinataProvider } = require('./pinata-provider')
const { ArweaveProvider } = require('./arweave-provider')

class StorageOrchestrator {
  constructor(config = {}) {
    this.providers = []

    // Primary: IPFS via Pinata
    if (config.pinataJWT) {
      this.providers.push(new PinataProvider(config.pinataJWT))
    }

    // Optional archival: Arweave
    if (config.arweaveEnabled && config.arweaveWalletPath) {
      this.providers.push(new ArweaveProvider({
        walletPath: config.arweaveWalletPath,
        host: config.arweaveHost,
        port: config.arweavePort,
        protocol: config.arweaveProtocol,
        timeoutMs: config.arweaveTimeoutMs
      }))
    }
  }

  /**
   * Upload to all available providers.
   *
   * @param {string} filePath — absolute path to encrypted file
   * @param {string} originalFileName — e.g. "MEMORY.md"
   * @returns {Promise<{
   *   results: Record<string, {id?: string, url?: string, error?: string}>,
   *   ok: boolean,
   *   primaryId?: string,
   *   primaryUrl?: string
   * }>}
   */
  async upload(filePath, originalFileName) {
    if (this.providers.length === 0) {
      throw new Error('No storage providers are configured. Add Pinata JWT or Arweave wallet.')
    }

    const results = {}
    let anySuccess = false
    let primaryId = null
    let primaryUrl = null

    for (const provider of this.providers) {
      try {
        const result = await provider.upload(filePath, originalFileName)
        results[provider.name] = { id: result.id, url: result.url }
        anySuccess = true
        if (!primaryId) {
          primaryId = result.id
          primaryUrl = result.url
        }
      } catch (err) {
        results[provider.name] = { error: err.message }
      }
    }

    if (!anySuccess) {
      const errors = Object.entries(results)
        .map(([name, r]) => `${name}: ${r.error}`)
        .join(' | ')
      throw new Error(`All storage providers failed. ${errors}`)
    }

    return { results, ok: true, primaryId, primaryUrl }
  }

  /**
   * Get status for a provider-specific identifier.
   * @param {string} providerName — 'ipfs' | 'arweave'
   * @param {string} id — CID or tx id
   */
  async getStatus(providerName, id) {
    const provider = this.providers.find((p) => p.name === providerName)
    if (!provider) {
      throw new Error(`Provider "${providerName}" is not configured.`)
    }
    return provider.getStatus(id)
  }
}

module.exports = { StorageOrchestrator, PinataProvider, ArweaveProvider }

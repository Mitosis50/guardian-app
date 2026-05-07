/**
 * storage/base.js — Storage Provider Interface
 *
 * Minimal contract shared by all backup destination adapters.
 */

'use strict'

class StorageProvider {
  get name() {
    throw new Error('StorageProvider subclass must define name')
  }

  /**
   * Check whether this provider is configured and ready.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    return false
  }

  /**
   * Upload an encrypted file.
   * @param {string} filePath — absolute path to the .enc file on disk
   * @param {string} originalFileName — human-readable filename (e.g. "MEMORY.md")
   * @returns {Promise<{id: string, url: string}>}
   */
  async upload(filePath, originalFileName) {
    throw new Error('StorageProvider subclass must implement upload()')
  }

  /**
   * Check confirmation / pinning status of a previously-uploaded item.
   * @param {string} id — provider-specific identifier (CID, tx id, etc.)
   * @returns {Promise<{ok: boolean, status: string}>}
   */
  async getStatus(id) {
    return { ok: false, status: 'unknown' }
  }
}

module.exports = { StorageProvider }

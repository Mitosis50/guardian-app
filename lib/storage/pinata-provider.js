/**
 * storage/pinata-provider.js — IPFS via Pinata
 *
 * Wraps the existing Pinata SDK in the StorageProvider interface.
 */

'use strict'

const fs = require('fs')
const path = require('path')
const pinataSDK = require('@pinata/sdk')
const { StorageProvider } = require('./base')

class PinataProvider extends StorageProvider {
  constructor(jwt) {
    super()
    this.jwt = jwt ? String(jwt).trim() : ''
  }

  get name() {
    return 'ipfs'
  }

  async isAvailable() {
    return Boolean(this.jwt)
  }

  async upload(filePath, originalFileName) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Encrypted file not found: ${filePath}`)
    }
    if (!this.jwt) {
      throw new Error('Pinata JWT is missing')
    }

    const pinata = new pinataSDK({ pinataJWTKey: this.jwt })
    const stream = fs.createReadStream(filePath)
    const options = {
      pinataMetadata: {
        name: `${originalFileName || path.basename(filePath)}.encrypted`
      },
      pinataOptions: {
        cidVersion: 1
      }
    }

    const result = await pinata.pinFileToIPFS(stream, options)
    const cid = result && result.IpfsHash
    if (!cid) {
      throw new Error('Pinata response did not include IpfsHash')
    }
    return {
      id: cid,
      url: `https://gateway.pinata.cloud/ipfs/${cid}`
    }
  }

  async getStatus(cid) {
    // Lightweight heuristic: we don't have Pinata pin status without an API call.
    // Return optimistic pending; consumers can poll Pinata directly if needed.
    return { ok: Boolean(cid), status: 'pinned' }
  }
}

module.exports = { PinataProvider }

const fs = require('fs')
const path = require('path')
const pinataSDK = require('@pinata/sdk')
const { StorageOrchestrator } = require('./storage')

function makeClient(jwt) {
  if (!jwt) throw new Error('Pinata JWT is required')
  return new pinataSDK({ pinataJWTKey: jwt })
}

async function uploadEncryptedFile(filePath, jwt, originalFileName) {
  if (!fs.existsSync(filePath)) throw new Error(`Queued encrypted file not found: ${filePath}`)

  const pinata = makeClient(jwt)
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
  if (!cid) throw new Error('Pinata response did not include IpfsHash')
  return { cid, ipfsUrl: `https://gateway.pinata.cloud/ipfs/${cid}` }
}

/**
 * Upload using the new provider orchestrator.
 * Supports IPFS + optional Arweave archival in a single call.
 *
 * @param {string} filePath — absolute path to encrypted file
 * @param {object} config — full Guardian config object (pinataJWT, arweaveEnabled, etc.)
 * @param {string} originalFileName — e.g. "MEMORY.md"
 * @returns {Promise<{
 *   results: Record<string, {id?: string, url?: string, error?: string}>,
 *   ok: boolean,
 *   primaryId?: string,
 *   primaryUrl?: string
 * }>}
 */
async function uploadEncryptedFileWithProviders(filePath, config, originalFileName) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Queued encrypted file not found: ${filePath}`)
  }
  const orchestrator = new StorageOrchestrator(config)
  return orchestrator.upload(filePath, originalFileName)
}

module.exports = { makeClient, uploadEncryptedFile, uploadEncryptedFileWithProviders }

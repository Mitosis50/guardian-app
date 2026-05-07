/**
 * arweave-gateway.js — Retrieve encrypted backups from Arweave gateways
 *
 * Downloads a transaction by id, verifies the response, and returns raw bytes.
 * The caller is responsible for decryption.
 */

'use strict'

const https = require('https')
const http = require('http')

const DEFAULT_GATEWAYS = [
  'https://arweave.net',
  'https://arweave.dev'
]

function fetchBuffer(url, timeoutMs = 60000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { timeout: timeoutMs }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchBuffer(res.headers.location, timeoutMs).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} from ${url}`))
      }
      const chunks = []
      res.on('data', (d) => chunks.push(d))
      res.on('end', () => resolve(Buffer.concat(chunks)))
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Request timeout after ${timeoutMs}ms`))
    })
  })
}

/**
 * Download a transaction payload from available gateways.
 * @param {string} txId — Arweave transaction id
 * @param {object} options
 * @param {string[]} [options.gateways] — override gateway list
 * @param {number} [options.timeoutMs] — per-request timeout
 * @returns {Promise<Buffer>}
 */
async function downloadTransaction(txId, options = {}) {
  if (!txId || typeof txId !== 'string') {
    throw new Error('Arweave transaction id is required')
  }

  const gateways = options.gateways || DEFAULT_GATEWAYS
  const timeoutMs = options.timeoutMs || 60000
  let lastError

  for (const gateway of gateways) {
    const url = `${gateway.replace(/\/$/, '')}/${txId}`
    try {
      const buffer = await fetchBuffer(url, timeoutMs)
      return buffer
    } catch (err) {
      lastError = err
      console.warn(`[guardian] Arweave gateway failed (${gateway}): ${err.message}`)
    }
  }

  throw new Error(
    `All Arweave gateways failed for tx ${txId}. Last error: ${lastError.message}`
  )
}

module.exports = { downloadTransaction, DEFAULT_GATEWAYS }

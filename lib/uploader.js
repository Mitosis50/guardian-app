const fs = require('fs')
const path = require('path')
const pinataSDK = require('@pinata/sdk')

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

module.exports = { makeClient, uploadEncryptedFile }

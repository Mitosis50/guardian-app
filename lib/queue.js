const fs = require('fs')
const path = require('path')

function isQueueFilePath(queueDir, filePath) {
  if (!queueDir || !filePath || typeof filePath !== 'string') return false
  const resolvedQueueDir = path.resolve(queueDir)
  const resolvedFilePath = path.resolve(filePath)
  if (!resolvedFilePath.startsWith(`${resolvedQueueDir}${path.sep}`)) return false
  if (!/^\d+-[A-Za-z0-9._-]+\.enc$/.test(path.basename(resolvedFilePath))) return false
  try {
    if (!fs.statSync(resolvedQueueDir).isDirectory()) return false
    const lstat = fs.lstatSync(resolvedFilePath)
    if (!lstat.isFile()) return false
    const realQueueDir = fs.realpathSync(resolvedQueueDir)
    const realFilePath = fs.realpathSync(resolvedFilePath)
    if (!realFilePath.startsWith(`${realQueueDir}${path.sep}`)) return false
    return true
  } catch (_) {
    return false
  }
}

class Queue {
  constructor(store) {
    this.store = store
  }

  all() {
    return this.store.get('queue', [])
  }

  size() {
    return this.all().length
  }

  add(item) {
    const current = this.all()
    const identity = item.encryptedPath || item.filePath
    const withoutSameItem = identity
      ? current.filter((queued) => (queued.encryptedPath || queued.filePath) !== identity)
      : current
    this.store.set('queue', [...withoutSameItem, item])
  }

  reconcileFromDisk(queueDir) {
    if (!queueDir || !fs.existsSync(queueDir)) return { added: 0, existing: this.size(), staleRemoved: 0, queueDir }

    const current = this.all()
    const existingItems = current.filter((item) => !item.encryptedPath || isQueueFilePath(queueDir, item.encryptedPath))
    const staleRemoved = current.length - existingItems.length
    const knownEncryptedPaths = new Set(existingItems.map((item) => item.encryptedPath && path.resolve(item.encryptedPath)).filter(Boolean))
    const additions = []

    for (const fileName of fs.readdirSync(queueDir)) {
      if (!/^\d+-[A-Za-z0-9._-]+\.enc$/.test(fileName)) continue
      const encryptedPath = path.join(queueDir, fileName)
      if (knownEncryptedPaths.has(path.resolve(encryptedPath))) continue
      if (!isQueueFilePath(queueDir, encryptedPath)) continue

      const stat = fs.statSync(encryptedPath)

      const originalName = fileName.replace(/^\d+-/, '').replace(/\.enc$/, '')
      additions.push({
        filePath: null,
        encryptedPath,
        fileName: originalName || fileName,
        queuedAt: new Date(stat.mtimeMs).toISOString(),
        recoveredFromDisk: true
      })
    }

    if (additions.length || staleRemoved) this.store.set('queue', [...existingItems, ...additions])
    return { added: additions.length, existing: existingItems.length, staleRemoved, queueDir }
  }

  removeMany(items) {
    const removeSet = new Set(items.map((item) => item.encryptedPath))
    this.store.set('queue', this.all().filter((item) => !removeSet.has(item.encryptedPath)))
  }
}

module.exports = { Queue }

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
    const withoutSameFile = current.filter((queued) => queued.filePath !== item.filePath)
    this.store.set('queue', [...withoutSameFile, item])
  }

  removeMany(items) {
    const removeSet = new Set(items.map((item) => item.encryptedPath))
    this.store.set('queue', this.all().filter((item) => !removeSet.has(item.encryptedPath)))
  }
}

module.exports = { Queue }

const fs = require('fs')
const path = require('path')
const chokidar = require('chokidar')

const SACRED_FILES = new Set([
  'SOUL.md',
  'AGENTS.md',
  'MEMORY.md',
  'USER.md',
  'HEARTBEAT.md',
  'IDENTITY.md',
  'TOOLS.md'
])

function existingPaths(paths) {
  return paths.filter((p) => {
    try {
      fs.mkdirSync(p, { recursive: true })
      return true
    } catch (error) {
      console.warn('[guardian] cannot watch path:', p, error.message)
      return false
    }
  })
}

function shouldIgnore(filePath) {
  const parts = filePath.split(/[\\/]+/)
  return parts.includes('node_modules') || parts.includes('.git') || parts.includes('.guardian-queue')
}

function isSacredMarkdown(filePath) {
  return SACRED_FILES.has(path.basename(filePath))
}

function createWatcher(paths, onMarkdownChange) {
  const watchPaths = existingPaths(paths)
  const watcher = chokidar.watch(watchPaths, {
    ignored: shouldIgnore,
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 800, pollInterval: 100 }
  })

  const handle = (filePath) => {
    if (isSacredMarkdown(filePath)) onMarkdownChange(filePath)
  }

  watcher.on('add', handle)
  watcher.on('change', handle)
  watcher.on('error', (error) => console.error('[guardian] watcher error:', error))
  console.log('[guardian] watching sacred files in', watchPaths)
  return watcher
}

module.exports = { createWatcher, SACRED_FILES, isSacredMarkdown }

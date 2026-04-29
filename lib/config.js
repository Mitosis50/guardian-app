const os = require('os')
const path = require('path')
const crypto = require('crypto')
const Store = require('electron-store')

const DEFAULTS = {
  email: '',
  watchPaths: [path.join(os.homedir(), '.hermes'), path.join(os.homedir(), '.openclaw', 'workspace')],
  encryptionKeyPath: path.join(os.homedir(), '.guardian-key'),
  pinataJWT: '',
  tier: 'free',
  lastUploadAt: '',
  queue: [],
  uploadLog: []
}

function localEncryptionKey() {
  return crypto.createHash('sha256').update(`${os.hostname()}:${os.homedir()}:agent-guardian`).digest('hex')
}

function createStore() {
  return new Store({
    name: 'agent-guardian',
    encryptionKey: localEncryptionKey(),
    defaults: DEFAULTS,
    clearInvalidConfig: true
  })
}

function expandHome(input) {
  if (typeof input !== 'string') return input
  if (input === '~') return os.homedir()
  if (input.startsWith(`~${path.sep}`) || input.startsWith('~/')) return path.join(os.homedir(), input.slice(2))
  return input
}

function normalizeWatchPaths(paths) {
  const source = Array.isArray(paths) && paths.length ? paths : DEFAULTS.watchPaths
  return [...new Set(source.map(expandHome).filter(Boolean))]
}

function normalizeTier(tier) {
  return ['free', 'guardian', 'pro', 'lifetime'].includes(tier) ? tier : 'free'
}

function getConfig(store) {
  const current = { ...DEFAULTS, ...store.store }
  return {
    ...current,
    watchPaths: normalizeWatchPaths(current.watchPaths),
    encryptionKeyPath: expandHome(current.encryptionKeyPath || DEFAULTS.encryptionKeyPath),
    tier: normalizeTier(current.tier),
    queue: Array.isArray(current.queue) ? current.queue : [],
    uploadLog: Array.isArray(current.uploadLog) ? current.uploadLog : []
  }
}

function saveConfig(store, partial) {
  const next = { ...getConfig(store), ...partial }
  next.watchPaths = normalizeWatchPaths(next.watchPaths)
  next.encryptionKeyPath = expandHome(next.encryptionKeyPath || DEFAULTS.encryptionKeyPath)
  next.tier = normalizeTier(next.tier)
  next.pinataJWT = String(next.pinataJWT || '').trim()
  next.email = String(next.email || '').trim().toLowerCase()
  store.set(next)
}

function addUploadLog(store, item) {
  const log = getConfig(store).uploadLog || []
  store.set('uploadLog', [...log, item].slice(-200))
}

module.exports = { createStore, getConfig, saveConfig, addUploadLog, expandHome }

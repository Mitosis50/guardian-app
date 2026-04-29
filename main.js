const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell } = require('electron')
const path = require('path')
const { createStore, getConfig, saveConfig, addUploadLog } = require('./lib/config')
const { createTrayIcon } = require('./lib/icons')
const { Queue } = require('./lib/queue')
const { createWatcher } = require('./lib/watcher')
const { createScheduler } = require('./lib/scheduler')
const { HealthTrail } = require('./lib/health')
const { encryptFile } = require('./lib/encryption')
const { uploadEncryptedFile } = require('./lib/uploader')
const { listBackups, recoverOne, recoverAll } = require('./lib/recovery')

let tray
let settingsWindow
let watcher
let scheduler
let currentState = 'idle'
let isUploading = false
let healthTrail
let healthHeartbeatTimer
const store = createStore()
const queue = new Queue(store)

const STATE_LABELS = { idle: '🛡️', active: '🛡️⬆', alert: '🛡️!', error: '🛡️✗' }

function setState(state) {
  currentState = state
  if (healthTrail) healthTrail.update({ state, ok: state !== 'error' })
  if (tray) {
    tray.setTitle(STATE_LABELS[state] || '🛡️')
    tray.setContextMenu(buildMenu())
    tray.setToolTip(`Agent Guardian — ${state}`)
  }
}

function buildMenu() {
  const config = getConfig(store)
  const pending = queue.size()
  const lastUpload = config.lastUploadAt ? new Date(config.lastUploadAt).toLocaleString() : 'Never'
  const recent = (config.uploadLog || []).slice(-5).reverse()

  return Menu.buildFromTemplate([
    { label: 'Agent Guardian 🛡️', enabled: false },
    { label: `Status: ${currentState}`, enabled: false },
    { label: `Queued files: ${pending}`, enabled: false },
    { label: `Tier: ${config.tier}`, enabled: false },
    { label: `Last upload: ${lastUpload}`, enabled: false },
    { type: 'separator' },
    { label: 'Upload Now', enabled: pending > 0 && !isUploading, click: () => uploadQueueNow() },
    { label: 'Settings…', click: () => openSettingsWindow() },
    ...(recent.length ? [{ type: 'separator' }] : []),
    ...recent.map((item) => ({
      label: `${item.fileName} → ${String(item.cid).slice(0, 10)}…`,
      click: () => shell.openExternal(item.ipfsUrl)
    })),
    { type: 'separator' },
    { role: 'quit', label: 'Quit Agent Guardian' }
  ])
}

async function handleChangedFile(filePath) {
  try {
    const config = getConfig(store)
    const encrypted = await encryptFile(filePath, config.encryptionKeyPath)
    queue.add({ filePath, encryptedPath: encrypted.outputPath, fileName: path.basename(filePath), queuedAt: new Date().toISOString() })
    if (healthTrail) healthTrail.event('file:queued', { filePath, fileName: path.basename(filePath), queueSize: queue.size() })
    setState('alert')
  } catch (error) {
    console.error('[guardian] encrypt/queue failed:', error)
    if (healthTrail) healthTrail.event('file:queue-error', { filePath, message: error.message })
    setState('error')
  }
}

async function uploadQueueNow(options = {}) {
  if (isUploading) return { skipped: true, reason: 'upload-already-running', queueSize: queue.size() }
  if (queue.size() === 0) return { skipped: true, reason: 'queue-empty', queueSize: 0 }
  isUploading = true
  setState('active')

  const config = getConfig(store)
  const items = queue.all()
  const uploaded = []

  try {
    if (!config.pinataJWT) throw new Error('Pinata JWT is missing. Open Settings and save your token.')

    for (const item of items) {
      const result = await uploadEncryptedFile(item.encryptedPath, config.pinataJWT, item.fileName)
      const logItem = {
        fileName: item.fileName,
        cid: result.cid,
        ipfsUrl: result.ipfsUrl,
        uploadedAt: new Date().toISOString()
      }
      addUploadLog(store, logItem)
      uploaded.push(item)
      console.log('[guardian] uploaded', logItem)
      if (healthTrail) healthTrail.event('upload:success', { fileName: logItem.fileName, cid: logItem.cid })
    }

    queue.removeMany(uploaded)
    saveConfig(store, { lastUploadAt: new Date().toISOString() })
    setState(queue.size() > 0 ? 'alert' : 'idle')
    return { skipped: false, uploadedCount: uploaded.length, queueSize: queue.size(), source: options.source || 'manual' }
  } catch (error) {
    console.error('[guardian] upload failed:', error)
    if (healthTrail) healthTrail.event('upload:error', { message: error.message, source: options.source || 'manual' })
    setState('error')
    if (options.throwOnError) throw error
    return { skipped: false, error: error.message, uploadedCount: uploaded.length, queueSize: queue.size(), source: options.source || 'manual' }
  } finally {
    isUploading = false
  }
}

function restartServices() {
  if (watcher) watcher.close()
  if (scheduler) scheduler.stop()

  const config = getConfig(store)
  watcher = createWatcher(config.watchPaths, handleChangedFile)
  if (healthTrail) healthTrail.event('watcher:started', { watchPaths: config.watchPaths, queueSize: queue.size() })
  scheduler = createScheduler(config.tier, () => uploadQueueNow({ source: 'cron', throwOnError: true }), { trail: healthTrail })
  setState(queue.size() > 0 ? 'alert' : 'idle')
}

function openSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus()
    return
  }

  settingsWindow = new BrowserWindow({
    width: 620,
    height: 620,
    title: 'Agent Guardian Settings',
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  settingsWindow.loadFile(path.join(__dirname, 'renderer', 'settings.html'))
  settingsWindow.on('closed', () => { settingsWindow = null })
}

ipcMain.handle('guardian:get-config', () => getConfig(store))
ipcMain.handle('guardian:save-config', (_event, partial) => {
  saveConfig(store, partial)
  restartServices()
  return getConfig(store)
})
ipcMain.handle('guardian:upload-now', () => uploadQueueNow({ source: 'manual' }))
ipcMain.handle('guardian:get-health', () => healthTrail ? healthTrail.getHealth({ public: true }) : { ok: false, state: 'not-ready' })

// ─── Recovery IPC ────────────────────────────────────────────────────────────
ipcMain.handle('guardian:list-backups', async (_event, email) => {
  try {
    const data = await listBackups(email)
    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

ipcMain.handle('guardian:recover-all', async (event, { email, outputDir }) => {
  const config = getConfig(store)
  const results = await recoverAll({
    email,
    keyPath: config.encryptionKeyPath,
    outputDir,
    onProgress: (msg) => {
      // Send progress updates back to the renderer
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.webContents.send('guardian:recovery-progress', msg)
      }
    }
  })
  return results
})

ipcMain.handle('guardian:recover-one', async (event, { cid, filename, outputDir }) => {
  const config = getConfig(store)
  try {
    const outPath = await recoverOne({
      cid,
      filename,
      keyPath: config.encryptionKeyPath,
      outputDir,
      onProgress: (msg) => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.webContents.send('guardian:recovery-progress', msg)
        }
      }
    })
    return { ok: true, path: outPath }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})

app.whenReady().then(() => {
  app.setName('Agent Guardian')
  healthTrail = new HealthTrail(app.getPath('userData'), { appVersion: app.getVersion() })
  healthHeartbeatTimer = setInterval(() => {
    const health = healthTrail.getHealth()
    healthTrail.event('health:heartbeat', { state: currentState, queueSize: queue.size() }, {
      scheduler: { lastHeartbeatAt: new Date().toISOString(), tier: health.scheduler.tier, expression: health.scheduler.expression }
    })
  }, 60 * 1000)
  healthHeartbeatTimer.unref?.()
  tray = new Tray(createTrayIcon())
  tray.setTitle('🛡️')
  tray.setContextMenu(buildMenu())
  tray.setToolTip('Agent Guardian — idle')
  tray.on('click', () => tray.popUpContextMenu())
  restartServices()
})

app.on('window-all-closed', (event) => {
  event.preventDefault()
})

app.on('before-quit', () => {
  if (watcher) watcher.close()
  if (scheduler) scheduler.stop()
  if (healthHeartbeatTimer) clearInterval(healthHeartbeatTimer)
  if (healthTrail) healthTrail.event('app:before-quit', { state: currentState, queueSize: queue.size() })
})

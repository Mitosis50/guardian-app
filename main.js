const { app, BrowserWindow, Menu, Tray, nativeImage, ipcMain, shell } = require('electron')
const path = require('path')
const { createStore, getConfig, saveConfig, addUploadLog } = require('./lib/config')
const { createTrayIcon } = require('./lib/icons')
const { Queue } = require('./lib/queue')
const { createWatcher } = require('./lib/watcher')
const { createScheduler } = require('./lib/scheduler')
const { encryptFile } = require('./lib/encryption')
const { uploadEncryptedFile } = require('./lib/uploader')
const { listBackups, recoverOne, recoverAll } = require('./lib/recovery')

let tray
let settingsWindow
let watcher
let scheduler
let currentState = 'idle'
let isUploading = false
const store = createStore()
const queue = new Queue(store)

const STATE_LABELS = { idle: '🛡️', active: '🛡️⬆', alert: '🛡️!', error: '🛡️✗' }

function setState(state) {
  currentState = state
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
    setState('alert')
  } catch (error) {
    console.error('[guardian] encrypt/queue failed:', error)
    setState('error')
  }
}

async function uploadQueueNow() {
  if (isUploading || queue.size() === 0) return
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
    }

    queue.removeMany(uploaded)
    saveConfig(store, { lastUploadAt: new Date().toISOString() })
    setState(queue.size() > 0 ? 'alert' : 'idle')
  } catch (error) {
    console.error('[guardian] upload failed:', error)
    setState('error')
  } finally {
    isUploading = false
  }
}

function restartServices() {
  if (watcher) watcher.close()
  if (scheduler) scheduler.stop()

  const config = getConfig(store)
  watcher = createWatcher(config.watchPaths, handleChangedFile)
  scheduler = createScheduler(config.tier, uploadQueueNow)
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
ipcMain.handle('guardian:upload-now', () => uploadQueueNow())

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
})

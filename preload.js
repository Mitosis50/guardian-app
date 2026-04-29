const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('guardian', {
  // Config
  getConfig:    ()       => ipcRenderer.invoke('guardian:get-config'),
  saveConfig:   (config) => ipcRenderer.invoke('guardian:save-config', config),

  // Backup
  uploadNow:    ()       => ipcRenderer.invoke('guardian:upload-now'),

  // Health / cron trail
  getHealth:    ()       => ipcRenderer.invoke('guardian:get-health'),

  // Recovery
  listBackups:  (email)  => ipcRenderer.invoke('guardian:list-backups', email),
  recoverAll:   (opts)   => ipcRenderer.invoke('guardian:recover-all', opts),
  recoverOne:   (opts)   => ipcRenderer.invoke('guardian:recover-one', opts),

  // Progress events (renderer listens via onRecoveryProgress)
  onRecoveryProgress: (callback) => {
    ipcRenderer.on('guardian:recovery-progress', (_event, msg) => callback(msg))
  },
})

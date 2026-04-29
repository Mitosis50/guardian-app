// ─── Tab Navigation ───────────────────────────────────────────────────────────

const tabs    = document.querySelectorAll('.tab')
const panels  = document.querySelectorAll('.tab-panel')

tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false') })
    panels.forEach(p => p.classList.remove('active'))
    tab.classList.add('active')
    tab.setAttribute('aria-selected', 'true')
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active')

    // Load backups when switching to backups or recovery tabs
    if (tab.dataset.tab === 'backups' || tab.dataset.tab === 'recovery') {
      loadBackupsIfNeeded()
    }
  })
})

// ─── Settings Tab ─────────────────────────────────────────────────────────────

const form              = document.querySelector('#settings-form')
const emailEl           = document.querySelector('#email')
const watchPathsEl      = document.querySelector('#watchPaths')
const encryptionKeyEl   = document.querySelector('#encryptionKeyPath')
const pinataJWTEl       = document.querySelector('#pinataJWT')
const tierEl            = document.querySelector('#tier')
const lastUploadAtEl    = document.querySelector('#lastUploadAt')
const queueCountEl      = document.querySelector('#queueCount')
const messageEl         = document.querySelector('#message')
const uploadNowBtn      = document.querySelector('#uploadNow')

function showMessage(text, isError = false) {
  messageEl.textContent = text
  messageEl.style.color = isError ? '#fecaca' : '#86efac'
  if (!isError) setTimeout(() => { messageEl.textContent = '' }, 4000)
}

async function loadSettings() {
  try {
    const config = await window.guardian.getConfig()
    emailEl.value          = config.email || ''
    watchPathsEl.value     = (config.watchPaths || []).join('\n')
    encryptionKeyEl.value  = config.encryptionKeyPath || ''
    pinataJWTEl.value      = config.pinataJWT || ''
    tierEl.value           = config.tier || 'free'
    lastUploadAtEl.textContent = config.lastUploadAt
      ? new Date(config.lastUploadAt).toLocaleString()
      : 'Never'
    queueCountEl.textContent = String((config.queue || []).length)
  } catch (err) {
    showMessage(`Failed to load settings: ${err.message}`, true)
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault()
  try {
    const config = await window.guardian.saveConfig({
      email:             emailEl.value.trim(),
      watchPaths:        watchPathsEl.value.split('\n').map(l => l.trim()).filter(Boolean),
      encryptionKeyPath: encryptionKeyEl.value.trim(),
      pinataJWT:         pinataJWTEl.value.trim(),
      tier:              tierEl.value,
    })
    showMessage('✅ Settings saved. Watcher and schedule restarted.')
    queueCountEl.textContent = String((config.queue || []).length)
    // Refresh recovery output dir default
    recoverOutputDirEl.placeholder = (config.watchPaths || [])[0] || '~/.hermes'
    // Invalidate backup cache so next visit re-fetches
    backupCache = null
  } catch (err) {
    showMessage(`Save failed: ${err.message}`, true)
  }
})

uploadNowBtn.addEventListener('click', async () => {
  try {
    uploadNowBtn.disabled = true
    showMessage('⬆ Upload started…')
    await window.guardian.uploadNow()
    await loadSettings()
    showMessage('✅ Upload triggered.')
  } catch (err) {
    showMessage(`Upload failed: ${err.message}`, true)
  } finally {
    uploadNowBtn.disabled = false
  }
})

// ─── Backups Tab ──────────────────────────────────────────────────────────────

const backupListEl    = document.querySelector('#backupList')
const refreshBtn      = document.querySelector('#refreshBackups')

let backupCache = null

async function loadBackupsIfNeeded(force = false) {
  if (backupCache && !force) {
    renderBackups(backupCache)
    renderRecoverFileList(backupCache)
    return
  }

  const config = await window.guardian.getConfig()
  const email  = config.email || ''

  if (!email) {
    backupListEl.innerHTML = '<p class="empty-state">⚠️ Add your email in Settings first, then click Refresh.</p>'
    return
  }

  backupListEl.innerHTML = '<p class="empty-state">Loading…</p>'

  const result = await window.guardian.listBackups(email)

  if (!result.ok) {
    backupListEl.innerHTML = `<p class="empty-state" style="color:#f87171;">❌ ${result.error}</p>`
    return
  }

  backupCache = result.data || []
  renderBackups(backupCache)
  renderRecoverFileList(backupCache)
}

function formatBytes(n) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(2)} MB`
}

function timeAgo(isoStr) {
  const diff = Date.now() - new Date(isoStr)
  const mins = Math.floor(diff / 60000)
  if (mins < 60)  return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)   return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function renderBackups(backups) {
  if (!backups.length) {
    backupListEl.innerHTML = '<p class="empty-state">No backups yet. Make sure a sacred file (MEMORY.md, etc.) exists in your watch folder.</p>'
    return
  }

  backupListEl.innerHTML = backups.map(b => `
    <div class="backup-item">
      <div class="backup-item-info">
        <div class="backup-item-name">📄 ${escHtml(b.filename || 'unknown')}</div>
        <div class="backup-item-meta">
          ${b.created_at ? timeAgo(b.created_at) : ''}
          ${b.size_bytes ? ' · ' + formatBytes(b.size_bytes) : ''}
          ${b.encrypted ? ' · 🔒 encrypted' : ''}
        </div>
        <div class="backup-item-cid">${escHtml(b.cid || '')}</div>
      </div>
      <div class="backup-item-actions">
        <a class="btn-ipfs-link" href="https://gateway.pinata.cloud/ipfs/${escHtml(b.cid)}" target="_blank" title="View on IPFS">🔗 IPFS</a>
        <button class="btn-recover-one" data-cid="${escHtml(b.cid)}" data-filename="${escHtml(b.filename || 'file')}">↓ Recover</button>
      </div>
    </div>
  `).join('')

  // Wire per-item recover buttons
  backupListEl.querySelectorAll('.btn-recover-one').forEach(btn => {
    btn.addEventListener('click', async () => {
      const config = await window.guardian.getConfig()
      const outputDir = (config.watchPaths || [])[0] || (config.encryptionKeyPath || '').replace(/\.guardian-key$/, '') || '~/.hermes'
      btn.disabled = true
      btn.textContent = '…'

      // Switch to recovery tab so user sees progress
      showRecoveryTab()
      const result = await window.guardian.recoverOne({
        cid: btn.dataset.cid,
        filename: btn.dataset.filename,
        outputDir,
      })

      btn.disabled = false
      btn.textContent = result.ok ? '✅ Done' : '❌ Failed'
      if (!result.ok) appendLog(`❌ ${result.error}`, 'error')
    })
  })
}

function showRecoveryTab() {
  tabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false') })
  panels.forEach(p => p.classList.remove('active'))
  const recoverTab = document.querySelector('[data-tab="recovery"]')
  recoverTab.classList.add('active')
  recoverTab.setAttribute('aria-selected', 'true')
  document.getElementById('tab-recovery').classList.add('active')
}

refreshBtn.addEventListener('click', () => loadBackupsIfNeeded(true))

// ─── Recovery Tab ─────────────────────────────────────────────────────────────

const recoverAllBtn      = document.querySelector('#recoverAllBtn')
const recoverOutputDirEl = document.querySelector('#recoverOutputDir')
const recoverLogEl       = document.querySelector('#recoverLog')
const recoverLogLines    = document.querySelector('#recoverLogLines')
const clearLogBtn        = document.querySelector('#clearLog')
const recoverFileListEl  = document.querySelector('#recoverFileList')
const recoverFileItemsEl = document.querySelector('#recoverFileItems')

// Listen for progress events pushed from main process
window.guardian.onRecoveryProgress((msg) => appendLog(msg))

function appendLog(msg, forceClass) {
  recoverLogEl.style.display = 'block'
  const line = document.createElement('div')
  line.className = 'log-line ' + (forceClass || classForMsg(msg))
  line.textContent = msg
  recoverLogLines.appendChild(line)
  recoverLogLines.scrollTop = recoverLogLines.scrollHeight
}

function classForMsg(msg) {
  if (msg.startsWith('✅')) return 'success'
  if (msg.startsWith('❌')) return 'error'
  return 'info'
}

clearLogBtn.addEventListener('click', () => {
  recoverLogLines.innerHTML = ''
  recoverLogEl.style.display = 'none'
})

recoverAllBtn.addEventListener('click', async () => {
  const config = await window.guardian.getConfig()
  const email  = config.email || ''

  if (!email) {
    appendLog('❌ No email set. Go to Settings and add your email first.', 'error')
    recoverLogEl.style.display = 'block'
    return
  }

  const outputDir = recoverOutputDirEl.value.trim()
    || (config.watchPaths || [])[0]
    || '~/.hermes'

  recoverAllBtn.disabled = true
  recoverAllBtn.textContent = '⏳  Recovering…'
  recoverLogLines.innerHTML = ''
  recoverLogEl.style.display = 'block'

  appendLog(`📧 Email: ${email}`, 'info')
  appendLog(`📁 Recovering to: ${outputDir}`, 'info')

  try {
    const result = await window.guardian.recoverAll({ email, outputDir })
    const { recovered = [], failed = [] } = result

    if (recovered.length) {
      appendLog(``, 'info')
      appendLog(`🛡️  ${recovered.length} file(s) recovered successfully!`, 'success')
      recovered.forEach(p => appendLog(`   → ${p}`, 'success'))
    }

    if (failed.length) {
      appendLog(``, 'info')
      appendLog(`⚠️  ${failed.length} file(s) could not be recovered:`, 'error')
      failed.forEach(f => appendLog(`   ❌ ${f.filename}: ${f.error}`, 'error'))
    }

    if (!recovered.length && !failed.length) {
      appendLog('No backups found for this email.', 'info')
    }

    // Refresh backup list cache
    backupCache = null
    await loadBackupsIfNeeded(true)

  } catch (err) {
    appendLog(`❌ Recovery error: ${err.message}`, 'error')
  } finally {
    recoverAllBtn.disabled = false
    recoverAllBtn.textContent = '🔄 \u00A0 Recover All My Files'
  }
})

function renderRecoverFileList(backups) {
  if (!backups.length) {
    recoverFileListEl.style.display = 'none'
    return
  }

  // Dedupe: show only the most recent backup per filename
  const seen = new Map()
  for (const b of backups) {
    if (!seen.has(b.filename)) seen.set(b.filename, b)
  }

  recoverFileListEl.style.display = 'block'
  recoverFileItemsEl.innerHTML = [...seen.values()].map(b => `
    <div class="backup-item">
      <div class="backup-item-info">
        <div class="backup-item-name">📄 ${escHtml(b.filename || 'unknown')}</div>
        <div class="backup-item-meta">${b.created_at ? timeAgo(b.created_at) : ''}</div>
      </div>
      <div class="backup-item-actions">
        <button class="btn-recover-one" data-cid="${escHtml(b.cid)}" data-filename="${escHtml(b.filename || 'file')}">↓ Recover</button>
      </div>
    </div>
  `).join('')

  recoverFileItemsEl.querySelectorAll('.btn-recover-one').forEach(btn => {
    btn.addEventListener('click', async () => {
      const config = await window.guardian.getConfig()
      const outputDir = recoverOutputDirEl.value.trim()
        || (config.watchPaths || [])[0]
        || '~/.hermes'

      btn.disabled = true
      btn.textContent = '⏳'
      appendLog(`↓ Recovering ${btn.dataset.filename}…`, 'info')
      recoverLogEl.style.display = 'block'

      const result = await window.guardian.recoverOne({
        cid: btn.dataset.cid,
        filename: btn.dataset.filename,
        outputDir,
      })

      btn.disabled = false
      if (result.ok) {
        btn.textContent = '✅'
        appendLog(`✅ ${btn.dataset.filename} → ${result.path}`, 'success')
      } else {
        btn.textContent = '❌'
        appendLog(`❌ ${btn.dataset.filename}: ${result.error}`, 'error')
      }
    })
  })
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ─── Init ─────────────────────────────────────────────────────────────────────

loadSettings()

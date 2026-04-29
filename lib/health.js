const fs = require('fs')
const path = require('path')

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

function redactString(value) {
  return value.replace(/\/Users\/[^\s)]+/g, '[path]').replace(/\/var\/[^\s)]+/g, '[path]')
}

function redact(details = {}) {
  if (typeof details === 'string') return redactString(details)
  if (Array.isArray(details)) return details.map((item) => redact(item))
  if (!details || typeof details !== 'object') return details
  const copy = { ...details }
  for (const key of Object.keys(copy)) {
    if (/jwt|token|secret|key/i.test(key)) {
      copy[key] = '[redacted]'
    } else if (/path|paths/i.test(key)) {
      copy[key] = Array.isArray(copy[key]) ? copy[key].map((value) => path.basename(String(value))) : path.basename(String(copy[key]))
    } else if (copy[key] && typeof copy[key] === 'object') {
      copy[key] = redact(copy[key])
    } else if (typeof copy[key] === 'string') {
      copy[key] = redactString(copy[key])
    }
  }
  return copy
}

class HealthTrail {
  constructor(userDataPath, options = {}) {
    if (!userDataPath) throw new Error('userDataPath is required')
    this.startedAt = new Date().toISOString()
    this.appVersion = options.appVersion || 'unknown'
    this.logDir = path.join(userDataPath, 'logs')
    this.logPath = path.join(this.logDir, 'cron.log')
    this.healthPath = path.join(userDataPath, 'health.json')
    this.status = {
      ok: true,
      state: 'starting',
      appVersion: this.appVersion,
      startedAt: this.startedAt,
      updatedAt: this.startedAt,
      scheduler: {
        tier: null,
        expression: null,
        startedAt: null,
        lastHeartbeatAt: null,
        lastRunAt: null,
        lastRunStatus: null,
        lastRunError: null,
        runCount: 0,
        successCount: 0,
        failureCount: 0,
        skippedCount: 0
      },
      paths: {
        cronLog: this.logPath,
        healthJson: this.healthPath
      }
    }
    ensureDir(this.logDir)
    this.write('health:init', { appVersion: this.appVersion })
    this.persist()
  }

  write(event, details = {}) {
    ensureDir(this.logDir)
    const entry = {
      ts: new Date().toISOString(),
      event,
      details: redact(details)
    }
    fs.appendFileSync(this.logPath, `${JSON.stringify(entry)}\n`, 'utf8')
    this.status.updatedAt = entry.ts
    return entry
  }

  update(partial = {}) {
    this.status = {
      ...this.status,
      ...partial,
      scheduler: {
        ...this.status.scheduler,
        ...(partial.scheduler || {})
      },
      paths: this.status.paths
    }
    this.status.updatedAt = new Date().toISOString()
    this.persist()
    return this.getHealth()
  }

  persist() {
    ensureDir(path.dirname(this.healthPath))
    fs.writeFileSync(this.healthPath, `${JSON.stringify(this.status, null, 2)}\n`, 'utf8')
  }

  event(name, details = {}, partial = {}) {
    const entry = this.write(name, details)
    this.update(partial)
    return entry
  }

  getHealth({ public: publicView = false } = {}) {
    const health = JSON.parse(JSON.stringify(this.status))
    if (publicView) {
      health.paths = {
        cronLog: Boolean(this.status.paths.cronLog),
        healthJson: Boolean(this.status.paths.healthJson)
      }
    }
    return health
  }
}

module.exports = { HealthTrail }

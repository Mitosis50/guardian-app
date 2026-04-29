const cron = require('node-cron')

const SCHEDULES = {
  free: '0 2 1,15 * *',       // twice a month
  guardian: '0 2 * * *',      // nightly
  pro: '0 */6 * * *',         // every 6 hours
  lifetime: '0 * * * *'       // every hour — ultimate tier
}

function createScheduler(tier, onFire, options = {}) {
  const expr = SCHEDULES[tier] || SCHEDULES.free
  const trail = options.trail

  const run = async () => {
    if (trail) {
      const current = trail.getHealth().scheduler || {}
      trail.event('cron:tick', { tier, expression: expr }, {
        state: 'cron-running',
        scheduler: {
          lastRunAt: new Date().toISOString(),
          lastRunStatus: 'running',
          lastRunError: null,
          runCount: Number(current.runCount || 0) + 1
        }
      })
    }

    try {
      const result = await onFire()
      if (trail) {
        const current = trail.getHealth().scheduler || {}
        const skipped = result && result.skipped === true
        trail.event(skipped ? 'cron:skipped' : 'cron:success', result || {}, {
          state: 'scheduler-ready',
          ok: true,
          scheduler: {
            lastRunStatus: skipped ? 'skipped' : 'success',
            lastRunError: null,
            successCount: Number(current.successCount || 0) + (skipped ? 0 : 1),
            skippedCount: Number(current.skippedCount || 0) + (skipped ? 1 : 0)
          }
        })
      }
      return result
    } catch (error) {
      if (trail) {
        const current = trail.getHealth().scheduler || {}
        trail.event('cron:error', { message: error.message, stack: error.stack }, {
          state: 'error',
          ok: false,
          scheduler: {
            lastRunStatus: 'error',
            lastRunError: error.message,
            failureCount: Number(current.failureCount || 0) + 1
          }
        })
      }
      throw error
    }
  }

  const task = cron.schedule(expr, run, { scheduled: true })
  console.log(`[guardian] scheduled ${tier} uploads: ${expr}`)
  if (trail) {
    trail.event('cron:scheduled', { tier, expression: expr }, {
      state: 'scheduler-ready',
      ok: true,
      scheduler: { tier, expression: expr, startedAt: new Date().toISOString(), lastRunStatus: 'scheduled' }
    })
  }
  return task
}

module.exports = { createScheduler, SCHEDULES }

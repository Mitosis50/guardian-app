const cron = require('node-cron')

const SCHEDULES = {
  free: '0 2 1,15 * *',       // twice a month
  guardian: '0 2 * * *',      // nightly
  pro: '0 */6 * * *',         // every 6 hours
  lifetime: '0 * * * *'       // every hour — ultimate tier
}

function createScheduler(tier, onFire) {
  const expr = SCHEDULES[tier] || SCHEDULES.free
  const task = cron.schedule(expr, onFire, { scheduled: true })
  console.log(`[guardian] scheduled ${tier} uploads: ${expr}`)
  return task
}

module.exports = { createScheduler, SCHEDULES }

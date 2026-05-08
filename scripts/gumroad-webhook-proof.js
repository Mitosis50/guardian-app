#!/usr/bin/env node
'use strict'

/**
 * Agent Guardian — Live Gumroad Webhook Proof Script
 *
 * Simulates Gumroad x-www-form-urlencoded sale webhooks against the live
 * Railway API. This script intentionally uses clearly synthetic test data only.
 *
 * Usage:
 *   GUARDIAN_WEBHOOK_SECRET=<secret> node scripts/gumroad-webhook-proof.js
 */

const https = require('https')
const fs = require('fs')
const path = require('path')

const API_BASE = 'https://beneficial-commitment-production-4481.up.railway.app'
const REPORT_PATH = '/Users/aiagents/Desktop/Hero7-Webhook-Proof-Report.md'
const WEBHOOK_SECRET = process.env.GUARDIAN_WEBHOOK_SECRET || ''
const RUN_STARTED_AT = new Date()
const RUN_ID = RUN_STARTED_AT.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)

const TIERS = [
  { tier: 'free', permalink: 'befbcx' },
  { tier: 'guardian', permalink: 'ninnii' },
  { tier: 'pro', permalink: 'cjpizc' },
  { tier: 'lifetime', permalink: 'ugmpm' },
]

const NEGATIVE_CASES = [
  {
    name: 'unknown permalink rejection/skip',
    expected: 'API should ignore/skip unknown product_permalink without activating a tier',
    form: {
      email: `test-webhook-proof-unknown-${RUN_ID}@agentbotguardian.com`,
      product_permalink: 'unknown-proof-permalink',
      sale_id: `TEST-PROOF-UNKNOWN-${RUN_ID}`,
      seller_id: 'TEST-SELLER',
    },
    isPass: (result) => {
      const text = `${result.status} ${result.body}`.toLowerCase()
      if (result.status >= 500) return false
      return result.status === 400 || result.status === 422 || result.status === 200 ||
        text.includes('unknown') || text.includes('skip') || text.includes('ignore') || text.includes('invalid')
    },
  },
  {
    name: 'missing email rejection',
    expected: 'API should reject missing email',
    form: {
      product_permalink: 'ninnii',
      sale_id: `TEST-PROOF-MISSING-EMAIL-${RUN_ID}`,
      seller_id: 'TEST-SELLER',
    },
    isPass: (result) => {
      const text = `${result.status} ${result.body}`.toLowerCase()
      if (result.status >= 500) return false
      return result.status === 400 || result.status === 422 || text.includes('email') || text.includes('missing') || text.includes('required')
    },
  },
]

function request(method, urlString, { headers = {}, body = '', timeoutMs = 20000 } = {}) {
  return new Promise((resolve) => {
    const started = Date.now()
    const url = new URL(urlString)
    const req = https.request({
      method,
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || 443,
      path: `${url.pathname}${url.search}`,
      headers,
      timeout: timeoutMs,
    }, (res) => {
      const chunks = []
      res.on('data', chunk => chunks.push(chunk))
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8')
        let parsed = null
        try { parsed = JSON.parse(rawBody) } catch (_) {}
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: res.headers,
          body: rawBody,
          json: parsed,
          durationMs: Date.now() - started,
          error: null,
          url: urlString,
          method,
        })
      })
    })

    req.on('timeout', () => {
      req.destroy(new Error(`Request timeout after ${timeoutMs}ms`))
    })

    req.on('error', (err) => {
      resolve({
        ok: false,
        status: 0,
        headers: {},
        body: '',
        json: null,
        durationMs: Date.now() - started,
        error: err.message,
        url: urlString,
        method,
      })
    })

    if (body) req.write(body)
    req.end()
  })
}

function formEncode(fields) {
  return Object.entries(fields)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join('&')
}

function oneLineBody(body) {
  if (!body) return ''
  return body.replace(/\s+/g, ' ').trim().slice(0, 1000)
}

function stringifyBody(result) {
  if (result.error) return `ERROR: ${result.error}`
  if (!result.body) return '(empty body)'
  try { return JSON.stringify(JSON.parse(result.body), null, 2) } catch (_) { return result.body }
}

function passFail(pass) {
  return pass ? 'PASS' : 'FAIL'
}

function statusLine(result) {
  if (result.error) return `ERROR (${result.error})`
  return `HTTP ${result.status} (${result.durationMs}ms)`
}

async function getEndpoint(endpoint) {
  return request('GET', `${API_BASE}${endpoint}`, { headers: { accept: 'application/json,text/plain,*/*' } })
}

async function postWebhook(form) {
  const body = formEncode(form)
  const url = `${API_BASE}/webhook/gumroad?secret=${encodeURIComponent(WEBHOOK_SECRET)}`
  return request('POST', url, {
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'content-length': Buffer.byteLength(body),
      accept: 'application/json,text/plain,*/*',
      'user-agent': 'AgentGuardian-Hero7-WebhookProof/1.0',
    },
    body,
  })
}

function tierPassExpected(result, expectedTier) {
  const text = `${result.status} ${result.body}`.toLowerCase()
  if (result.status >= 200 && result.status < 300) {
    if (!result.body) return true
    if (text.includes('error') && !text.includes(expectedTier)) return false
    return true
  }
  return false
}

async function probeTierEndpoint(email, expectedTier) {
  const endpoints = [
    { name: 'GET /api/tier/<email>', path: `/api/tier/${encodeURIComponent(email)}` },
    { name: 'GET /api/agents/<email>', path: `/api/agents/${encodeURIComponent(email)}` },
  ]

  const attempts = []
  for (const endpoint of endpoints) {
    const result = await getEndpoint(endpoint.path)
    const text = `${result.status} ${result.body}`.toLowerCase()
    const authBlocked = [401, 403].includes(result.status) || text.includes('unauthorized') || text.includes('auth')
    const notFound = result.status === 404
    const foundExpectedTier = text.includes(expectedTier.toLowerCase())
    const accessible = !result.error && !authBlocked && !notFound

    attempts.push({
      endpoint: endpoint.name,
      url: `${API_BASE}${endpoint.path}`,
      result,
      authBlocked,
      notFound,
      foundExpectedTier,
      accessible,
    })

    if (accessible && foundExpectedTier) {
      return {
        checked: true,
        confirmed: true,
        blocked: false,
        note: `${endpoint.name} returned expected tier "${expectedTier}"`,
        attempts,
      }
    }

    if (accessible && result.status >= 200 && result.status < 300) {
      return {
        checked: true,
        confirmed: false,
        blocked: false,
        note: `${endpoint.name} was accessible but did not clearly return expected tier "${expectedTier}"`,
        attempts,
      }
    }
  }

  const allBlocked = attempts.length > 0 && attempts.every(a => a.authBlocked)
  const allMissing = attempts.length > 0 && attempts.every(a => a.notFound)
  return {
    checked: true,
    confirmed: false,
    blocked: allBlocked,
    note: allBlocked
      ? 'Tier endpoint exists but appears blocked by auth.'
      : allMissing
        ? 'No unauthenticated /api/tier/<email> or /api/agents/<email> endpoint was found.'
        : 'Tier verification endpoint was not accessible or did not confirm the tier.',
    attempts,
  }
}

function buildReport(state) {
  const lines = []
  lines.push('# Agent Guardian — Live Gumroad Webhook Proof Report')
  lines.push('')
  lines.push(`Run started: ${RUN_STARTED_AT.toISOString()}`)
  lines.push(`Run finished: ${new Date().toISOString()}`)
  lines.push(`Railway API base URL: ${API_BASE}`)
  lines.push(`Webhook route: POST /webhook/gumroad`)
  lines.push(`Secret source: GUARDIAN_WEBHOOK_SECRET environment variable (${WEBHOOK_SECRET ? 'present' : 'missing'})`)
  lines.push(`Synthetic run id: ${RUN_ID}`)
  lines.push('')

  lines.push('## Health Checks')
  lines.push('')
  for (const check of state.healthChecks) {
    lines.push(`### ${check.name}`)
    lines.push(`- URL: ${check.result.url}`)
    lines.push(`- Result: ${statusLine(check.result)}`)
    lines.push(`- PASS/FAIL: ${passFail(check.pass)}`)
    lines.push('- Body:')
    lines.push('```')
    lines.push(stringifyBody(check.result))
    lines.push('```')
    lines.push('')
  }

  lines.push('## Webhook Tier Tests')
  lines.push('')
  if (state.skippedWebhookReason) {
    lines.push(`Webhook tests skipped: ${state.skippedWebhookReason}`)
    lines.push('')
  }
  for (const test of state.tierTests) {
    lines.push(`### ${test.tier}`)
    lines.push(`- Permalink: ${test.permalink}`)
    lines.push(`- Test email: ${test.email}`)
    lines.push(`- Sale ID: ${test.saleId}`)
    lines.push(`- Result: ${statusLine(test.result)}`)
    lines.push(`- PASS/FAIL: ${passFail(test.pass)}`)
    lines.push('- Response body:')
    lines.push('```')
    lines.push(stringifyBody(test.result))
    lines.push('```')
    lines.push('')
  }

  lines.push('## Negative/Rejection Tests')
  lines.push('')
  for (const test of state.negativeTests) {
    lines.push(`### ${test.name}`)
    lines.push(`- Expected: ${test.expected}`)
    lines.push(`- Product permalink: ${test.form.product_permalink || '(missing)'}`)
    lines.push(`- Test email: ${test.form.email || '(missing)'}`)
    lines.push(`- Sale ID: ${test.form.sale_id || '(missing)'}`)
    lines.push(`- Result: ${statusLine(test.result)}`)
    lines.push(`- PASS/FAIL: ${passFail(test.pass)}`)
    lines.push('- Response body:')
    lines.push('```')
    lines.push(stringifyBody(test.result))
    lines.push('```')
    lines.push('')
  }

  lines.push('## Tier Verification Endpoint Check')
  lines.push('')
  if (!state.tierVerification) {
    lines.push('Tier verification was not run because no successful tier webhook test was available or webhook tests were skipped.')
  } else {
    lines.push(`- Checked email: ${state.tierVerification.email}`)
    lines.push(`- Expected tier: ${state.tierVerification.expectedTier}`)
    lines.push(`- DB write confirmed: ${state.tierVerification.confirmed ? 'YES' : 'NO'}`)
    lines.push(`- Note: ${state.tierVerification.note}`)
    lines.push('')
    for (const attempt of state.tierVerification.attempts) {
      lines.push(`### ${attempt.endpoint}`)
      lines.push(`- URL: ${attempt.url}`)
      lines.push(`- Result: ${statusLine(attempt.result)}`)
      lines.push(`- Auth blocked: ${attempt.authBlocked ? 'YES' : 'NO'}`)
      lines.push(`- Not found: ${attempt.notFound ? 'YES' : 'NO'}`)
      lines.push(`- Found expected tier in response: ${attempt.foundExpectedTier ? 'YES' : 'NO'}`)
      lines.push('- Body:')
      lines.push('```')
      lines.push(stringifyBody(attempt.result))
      lines.push('```')
      lines.push('')
    }
  }
  lines.push('')

  lines.push('## Failed Cases / Escalation Notes')
  lines.push('')
  if (state.failedCases.length === 0) {
    lines.push('No failed cases recorded.')
  } else {
    for (const failure of state.failedCases) {
      lines.push(`- ${failure}`)
    }
  }
  lines.push('')

  lines.push('## Final Verdict')
  lines.push('')
  lines.push(state.finalVerdict)
  lines.push('')

  return lines.join('\n')
}

function writeReport(state) {
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true })
  const report = buildReport(state)
  fs.writeFileSync(REPORT_PATH, report, 'utf8')
  return report
}

async function main() {
  const state = {
    healthChecks: [],
    tierTests: [],
    negativeTests: [],
    tierVerification: null,
    skippedWebhookReason: '',
    failedCases: [],
    finalVerdict: 'WEBHOOK PIPELINE HAS ISSUES',
  }

  console.log('Agent Guardian — Live Gumroad Webhook Proof')
  console.log(`API: ${API_BASE}`)
  console.log(`Report: ${REPORT_PATH}`)
  console.log(`Secret present: ${WEBHOOK_SECRET ? 'YES' : 'NO'}`)
  console.log('')

  const health = await getEndpoint('/health')
  const validateHealth = await getEndpoint('/api/validate-health')
  state.healthChecks.push({ name: 'GET /health', result: health, pass: health.status >= 200 && health.status < 300 })
  state.healthChecks.push({ name: 'GET /api/validate-health', result: validateHealth, pass: validateHealth.status >= 200 && validateHealth.status < 300 })

  for (const check of state.healthChecks) {
    console.log(`${passFail(check.pass)} ${check.name}: ${statusLine(check.result)} ${oneLineBody(check.result.body)}`)
    if (!check.pass) state.failedCases.push(`${check.name} failed: ${statusLine(check.result)} ${oneLineBody(check.result.body)}`)
  }

  const apiUp = health.status >= 200 && health.status < 300
  if (!WEBHOOK_SECRET) {
    state.skippedWebhookReason = 'GUARDIAN_WEBHOOK_SECRET is not set. Live webhook POSTs require the real secret.'
    state.failedCases.push('Webhook tests skipped because GUARDIAN_WEBHOOK_SECRET is missing. Hero8/Dr. Basa must run with the real secret.')
  } else if (!apiUp) {
    state.skippedWebhookReason = 'GET /health did not pass, so live webhook writes were not attempted.'
    state.failedCases.push('Railway API health check failed before webhook tests.')
  } else {
    for (const { tier, permalink } of TIERS) {
      const email = `test-webhook-proof-${tier}-${RUN_ID}@agentbotguardian.com`
      const saleId = `TEST-PROOF-${tier.toUpperCase()}-${RUN_ID}`
      const form = { email, product_permalink: permalink, sale_id: saleId, seller_id: 'TEST-SELLER' }
      const result = await postWebhook(form)
      const pass = tierPassExpected(result, tier)
      const record = { tier, permalink, email, saleId, form, result, pass }
      state.tierTests.push(record)
      console.log(`${passFail(pass)} webhook ${tier}: ${statusLine(result)} ${oneLineBody(result.body)}`)

      if (!pass) {
        state.failedCases.push(`Webhook tier test failed for ${tier}/${permalink}: ${statusLine(result)} ${oneLineBody(result.body)}`)
      }
      if (result.status === 404 || result.status === 503) {
        state.failedCases.push(`ESCALATE: /webhook/gumroad returned ${result.status} for ${tier}. Railway may be down or route may be missing.`)
      }
      if (result.status === 401) {
        state.failedCases.push(`ESCALATE: /webhook/gumroad returned 401 for ${tier}. Secret is wrong or missing in runtime.`)
      }
    }

    for (const negative of NEGATIVE_CASES) {
      const result = await postWebhook(negative.form)
      const pass = negative.isPass(result)
      state.negativeTests.push({ ...negative, result, pass })
      console.log(`${passFail(pass)} ${negative.name}: ${statusLine(result)} ${oneLineBody(result.body)}`)
      if (!pass) {
        state.failedCases.push(`Negative case failed (${negative.name}): ${statusLine(result)} ${oneLineBody(result.body)}`)
      }
      if (result.status === 404 || result.status === 503) {
        state.failedCases.push(`ESCALATE: /webhook/gumroad returned ${result.status} during ${negative.name}. Railway may be down or route may be missing.`)
      }
      if (result.status === 401) {
        state.failedCases.push(`ESCALATE: /webhook/gumroad returned 401 during ${negative.name}. Secret is wrong or missing in runtime.`)
      }
    }

    const verificationCandidate = state.tierTests.find(t => t.pass)
    if (verificationCandidate) {
      const probe = await probeTierEndpoint(verificationCandidate.email, verificationCandidate.tier)
      state.tierVerification = {
        email: verificationCandidate.email,
        expectedTier: verificationCandidate.tier,
        ...probe,
      }
      console.log(`${probe.confirmed ? 'PASS' : 'FAIL'} tier verification: ${probe.note}`)
      if (!probe.confirmed) {
        state.failedCases.push(`Tier DB write was not confirmed for ${verificationCandidate.email}: ${probe.note}`)
        if (probe.blocked) {
          state.failedCases.push('ESCALATE: tier endpoint is not accessible without Supabase/session auth.')
        }
      }
    }
  }

  const allHealthPass = state.healthChecks.every(h => h.pass)
  const allTierPass = state.tierTests.length === TIERS.length && state.tierTests.every(t => t.pass)
  const allNegativePass = state.negativeTests.length === NEGATIVE_CASES.length && state.negativeTests.every(t => t.pass)
  const tierConfirmed = state.tierVerification && state.tierVerification.confirmed

  state.finalVerdict = allHealthPass && allTierPass && allNegativePass && tierConfirmed
    ? 'WEBHOOK PIPELINE VERIFIED'
    : 'WEBHOOK PIPELINE HAS ISSUES'

  writeReport(state)
  console.log('')
  console.log(`Final verdict: ${state.finalVerdict}`)
  console.log(`Report saved to ${REPORT_PATH}`)

  if (state.finalVerdict !== 'WEBHOOK PIPELINE VERIFIED') {
    process.exitCode = 1
  }
}

main().catch((err) => {
  const state = {
    healthChecks: [],
    tierTests: [],
    negativeTests: [],
    tierVerification: null,
    skippedWebhookReason: '',
    failedCases: [`Unhandled script error: ${err.stack || err.message}`],
    finalVerdict: 'WEBHOOK PIPELINE HAS ISSUES',
  }
  try { writeReport(state) } catch (_) {}
  console.error(err.stack || err.message)
  process.exitCode = 1
})

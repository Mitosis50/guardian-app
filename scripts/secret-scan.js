#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const ONLY_STAGED = process.argv.includes('--staged')
const MAX_BYTES = 1024 * 1024

const DENY_FILE_NAMES = [
  /^\.env(\.|$)/i,
  /(^|\/)(id_rsa|id_ed25519|\.arweave-wallet\.json|arweave-wallet.*\.json)$/i,
  /\.(pem|p12|p8|key|mobileprovision)$/i,
]

const SECRET_PATTERNS = [
  { name: 'private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/i },
  { name: 'JWT assignment', re: /\b(jwt|token|api[_-]?key|secret|password|passwd)\b\s*[:=]\s*['"][A-Za-z0-9_\-.=]{20,}['"]/i },
  { name: 'service-role key assignment', re: /\b(SUPABASE_SERVICE_ROLE_KEY|service[_-]?role)\b\s*[:=]\s*['"][A-Za-z0-9_\-.=]{20,}['"]/i },
  { name: 'Arweave JWK private exponent', re: /"d"\s*:\s*"[A-Za-z0-9_-]{40,}"/ },
]

function listFiles() {
  if (ONLY_STAGED) {
    const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: ROOT, encoding: 'utf8' })
    return out.split('\n').filter(Boolean)
  }
  const out = execFileSync('git', ['ls-files', '--others', '--cached', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' })
  return out.split('\n').filter(Boolean)
}

function isBinary(buffer) {
  return buffer.includes(0)
}

const findings = []
for (const rel of listFiles()) {
  const normalized = rel.replace(/\\/g, '/')
  if (DENY_FILE_NAMES.some((re) => re.test(normalized))) {
    findings.push(`${rel}: forbidden sensitive filename`)
    continue
  }

  const full = path.join(ROOT, rel)
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue
  const stat = fs.statSync(full)
  if (stat.size > MAX_BYTES) continue
  const data = fs.readFileSync(full)
  if (isBinary(data)) continue
  const text = data.toString('utf8')
  for (const pattern of SECRET_PATTERNS) {
    if (pattern.re.test(text)) findings.push(`${rel}: possible ${pattern.name}`)
  }
}

if (findings.length) {
  console.error('Secret scan failed. Review these files before committing:')
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`Secret scan passed (${ONLY_STAGED ? 'staged files' : 'tracked/untracked files'}).`)

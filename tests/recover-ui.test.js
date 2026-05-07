const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const ROOT = path.resolve(__dirname, '..')

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8')
}

test('Recover Files local decrypt UI is wired through renderer, preload, and main IPC', () => {
  const html = read('renderer/settings.html')
  const renderer = read('renderer/settings.js')
  const preload = read('preload.js')
  const main = read('main.js')

  assert.match(html, /data-tab="recovery"[^>]*>[^<]*Recover Files/)
  assert.match(html, /id="pickEncFileBtn"/)
  assert.match(html, /id="localDecryptBtn"/)
  assert.match(html, /id="localDecryptOutputDir"/)

  assert.match(renderer, /window\.guardian\.pickEncFile\(/)
  assert.match(renderer, /window\.guardian\.decryptLocal\(/)
  assert.match(preload, /pickEncFile:\s*\(\)\s*=>\s*ipcRenderer\.invoke\('guardian:pick-enc-file'\)/)
  assert.match(preload, /decryptLocal:\s*\(opts\)\s*=>\s*ipcRenderer\.invoke\('guardian:decrypt-local', opts\)/)

  assert.match(main, /const \{ decryptFile \} = require\('\.\/lib\/decrypt'\)/)
  assert.match(main, /ipcMain\.handle\('guardian:pick-enc-file'/)
  assert.match(main, /ipcMain\.handle\('guardian:decrypt-local'/)
  assert.match(main, /await decryptFile\(encFilePath, keyPath, outPath\)/)
})

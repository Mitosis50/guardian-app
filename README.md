# Agent Guardian Tray App — Phase 5

Tiny Electron menubar/system tray app for Mac and Windows. It watches agent folders for `.md` changes, encrypts changed files with AES-256-GCM, queues them locally, then uploads encrypted backups to Pinata/IPFS on the plan schedule or when you click **Upload Now**.

## What It Does

- Runs silently in the background
- Mac: menubar shield icon
- Windows: system tray shield icon
- Watches:
  - `~/.hermes/`
  - `~/.openclaw/workspace/`
- Encrypts changed `.md` files instantly
- Queues encrypted files in `~/.guardian-queue/`
- Uploads queued files to Pinata/IPFS
- Logs CIDs and gateway URLs locally
- Provides a plain HTML settings window

## Icon States

- Gray shield: idle / watching
- Green shield: upload in progress
- Yellow shield: files queued
- Red shield: last encrypt/upload failed

The tray dropdown shows status, queued count, tier, last upload, recent CID links, **Upload Now**, **Settings**, and **Quit**.

## Requirements

- Node.js 18+
- npm
- Pinata JWT for real uploads

## Run Locally

```bash
cd ~/guardian-app
npm install
npm start
```

The tray icon should appear in the macOS menubar or Windows system tray. Click it to open the dropdown menu.

## Configure

Open **Settings…** from the tray menu.

Settings persisted with encrypted `electron-store`:

- `watchPaths`
- `encryptionKeyPath` — default `~/.guardian-key`
- `pinataJWT` — masked in UI, stored in encrypted electron-store config
- `tier` — `free`, `guardian`, or `pro`
- `lastUploadAt`
- `uploadLog`

## Upload Schedule

Schedules are implemented with `node-cron`:

- Free: `0 2 1,15 * *` — 2 AM on the 1st and 15th
- Guardian: `0 2 * * *` — nightly at 2 AM
- Guardian Pro: `0 */6 * * *` — every 6 hours

**Upload Now** runs the upload cycle immediately for queued files.

## Encryption

Files are encrypted before upload with Node.js `crypto` using AES-256-GCM.

Output format:

```text
AGGCM1 + 12-byte IV + 16-byte auth tag + ciphertext
```

If `~/.guardian-key` does not exist, the app creates a 32-byte key and writes it with `0600` permissions.

Note: `~/guardian-core/` was not present on this machine during scaffolding, so this app includes compatible AES-256-GCM and Pinata upload modules rather than importing unavailable files. If `guardian-core/encrypt.js` and `guardian-core/upload.js` are restored, these modules can be swapped to import them directly.

## Build for Distribution

```bash
npm run build:mac
npm run build:win
```

Build output goes to `dist/`.

### Expected Signing Blockers

- macOS `.dmg` distribution outside local testing needs Apple Developer ID signing/notarization credentials.
- Windows `.exe` distribution for trust prompts needs a code-signing certificate; EV signing is preferred for SmartScreen reputation.

These are credential/signing steps, not app-code blockers.

## Files

```text
~/guardian-app/
  main.js
  preload.js
  package.json
  lib/
    config.js
    encryption.js
    icons.js
    queue.js
    scheduler.js
    uploader.js
    watcher.js
  renderer/
    settings.html
    settings.css
    settings.js
  README.md
```

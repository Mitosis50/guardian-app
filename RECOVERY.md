# 🛡️ Agent Guardian — File Recovery Guide

> **The golden rule of Agent Guardian:** Your files are encrypted with a key that only YOU control.
> This means we can never recover them for you — but it also means no one else ever can either.
> **Back up your `~/.guardian-key` file. It is the only thing that unlocks your backups.**

---

## Table of Contents

1. [How Your Files Are Protected](#how-your-files-are-protected)
2. [Before You Need Recovery — Do This Now](#before-you-need-recovery--do-this-now)
3. [Recovery: Step-by-Step for Humans](#recovery-step-by-step-for-humans)
4. [Recovery: Step-by-Step for AI Agents](#recovery-step-by-step-for-ai-agents)
5. [Finding Your Backup CIDs](#finding-your-backup-cids)
6. [Downloading from IPFS](#downloading-from-ipfs)
7. [Decrypting Your Files](#decrypting-your-files)
8. [Troubleshooting](#troubleshooting)
9. [Encryption Technical Reference](#encryption-technical-reference)

---

## How Your Files Are Protected

When Agent Guardian backs up a file, it:

1. **Watches** for changes to your sacred agent files (`MEMORY.md`, `SOUL.md`, `AGENTS.md`, `USER.md`, `HEARTBEAT.md`, `IDENTITY.md`, `TOOLS.md`)
2. **Encrypts** the file using **AES-256-GCM** with your local key (`~/.guardian-key`)
3. **Uploads** the encrypted `.enc` file to **IPFS** via Pinata
4. **Logs** the upload with the file name, IPFS CID, and timestamp

The encrypted file on IPFS is **content-addressed and pinned** — it cannot be deleted, altered, or accessed without your key.

```
Your file (MEMORY.md)
       │
       ▼
  [AES-256-GCM + your key]
       │
       ▼
  Encrypted blob (.enc)
       │
       ▼
  IPFS via Pinata
  → CID: bafyreig3x...
  → URL: https://gateway.pinata.cloud/ipfs/bafyreig3x...
```

---

## Before You Need Recovery — Do This Now

**Do this the moment you install Agent Guardian. Do not skip this.**

### 1. Back Up Your Encryption Key

```bash
# Your key is here:
cat ~/.guardian-key

# Back it up somewhere safe (USB drive, password manager, printed paper):
cp ~/.guardian-key /Volumes/USB_Drive/guardian-key-backup.txt

# Verify the backup is readable:
cat /Volumes/USB_Drive/guardian-key-backup.txt
# Should print a 64-character hex string like:
# a3f7c2d1e4b5082f9...
```

> ⚠️ **If you lose this key, your backups cannot be decrypted by anyone — including us.**
> Treat it like a password to your entire agent memory.

### 2. Note Your CIDs After Each Upload

After each upload, Agent Guardian logs the CID in your tray menu (last 5 uploads shown) and in the app's internal store. You can also query:

```bash
curl https://beneficial-commitment-production-4481.up.railway.app/api/agents/YOUR@EMAIL.com
```

Save those CIDs. They are your content receipts.

---

## Recovery: Step-by-Step for Humans

### Scenario A — Recovering on the Same Machine

You lost or accidentally deleted `MEMORY.md` but Agent Guardian is still installed.

**Step 1:** Find the CID for the file you want to recover.

Open the Agent Guardian tray menu — the last 5 uploads are listed. Click any entry to open it in your browser. Or query the API:

```bash
curl https://beneficial-commitment-production-4481.up.railway.app/api/agents/YOUR@EMAIL.com
```

**Step 2:** Download the encrypted backup from IPFS.

```bash
curl -o MEMORY.md.enc "https://gateway.pinata.cloud/ipfs/YOUR_CID_HERE"
```

**Step 3:** Decrypt the file.

```bash
cd ~/Applications/Agent\ Guardian.app/Contents/Resources/app
# or wherever the app is installed, or from the source:
cd ~/Desktop/guardian-app

node lib/decrypt.js MEMORY.md.enc
# ✅ Decrypted successfully → MEMORY.md
```

**Step 4:** Move the recovered file back to where it belongs.

```bash
mv MEMORY.md ~/.hermes/MEMORY.md
```

---

### Scenario B — Recovering on a New Machine

You have a new Mac. Your old machine is gone. You have your key backed up.

**Step 1:** Install Agent Guardian from [agentbotguardian.com](https://agentbotguardian.com)

**Step 2:** Restore your encryption key **before** launching the app.

```bash
# Copy your backed-up key to the expected location:
cp /Volumes/USB_Drive/guardian-key-backup.txt ~/.guardian-key
chmod 600 ~/.guardian-key
```

**Step 3:** Find your CIDs (from your email receipts, Gumroad purchase history, or API).

```bash
curl https://beneficial-commitment-production-4481.up.railway.app/api/agents/YOUR@EMAIL.com
```

**Step 4:** Download and decrypt each file.

```bash
# Download
curl -o MEMORY.md.enc "https://gateway.pinata.cloud/ipfs/YOUR_CID"

# Decrypt
node /Applications/Agent\ Guardian.app/Contents/Resources/app/lib/decrypt.js MEMORY.md.enc

# Place recovered file
mkdir -p ~/.hermes
mv MEMORY.md ~/.hermes/MEMORY.md
```

**Step 5:** Launch Agent Guardian. It will find your key and resume watching.

---

### Scenario C — Recovering Without the App Installed

You don't have Agent Guardian installed — just Node.js and your key file.

**Step 1:** Get the standalone decrypt script.

```bash
# Download just the decrypt utility
curl -o decrypt.js https://raw.githubusercontent.com/Mitosis50/guardian-app/main/lib/decrypt.js
```

**Step 2:** Restore your key.

```bash
echo "YOUR_64_CHAR_HEX_KEY_HERE" > ~/.guardian-key
chmod 600 ~/.guardian-key
```

**Step 3:** Download and decrypt.

```bash
curl -o MEMORY.md.enc "https://gateway.pinata.cloud/ipfs/YOUR_CID"
node decrypt.js MEMORY.md.enc --out MEMORY.md
```

That's it. No app required. Just Node.js ≥ 18 and your key.

---

## Recovery: Step-by-Step for AI Agents

This section is written **for autonomous agents** — Hermes, Hero7, Hero8, or any AI that needs to programmatically recover its own memory files.

### Prerequisites

- Node.js ≥ 18 in PATH
- `~/.guardian-key` must exist (or key passed via `--key`)
- `lib/decrypt.js` available (either from app install or standalone download)
- IPFS CID of the backup to recover

---

### Method 1: CLI (Recommended for Agents)

```bash
# List all backups for this agent's email
curl -s https://beneficial-commitment-production-4481.up.railway.app/api/agents/AGENT_EMAIL \
  | jq '.data[] | {filename, cid, created_at}'

# Download the most recent MEMORY.md backup
CID=$(curl -s https://beneficial-commitment-production-4481.up.railway.app/api/agents/AGENT_EMAIL \
  | jq -r '[.data[] | select(.filename == "MEMORY.md")] | first | .cid')

curl -o /tmp/MEMORY.md.enc "https://gateway.pinata.cloud/ipfs/$CID"

# Decrypt
node /path/to/lib/decrypt.js /tmp/MEMORY.md.enc --out ~/.hermes/MEMORY.md

echo "MEMORY.md recovered from CID: $CID"
```

### Method 2: Node.js API (for programmatic use)

```javascript
const { decryptFile } = require('/path/to/guardian-app/lib/decrypt')
const https = require('https')
const fs = require('fs/promises')
const os = require('os')
const path = require('path')

async function recoverFile(cid, targetPath, keyPath) {
  // 1. Download encrypted file from IPFS
  const encPath = path.join(os.tmpdir(), `guardian-recovery-${Date.now()}.enc`)
  await downloadFile(`https://gateway.pinata.cloud/ipfs/${cid}`, encPath)

  // 2. Decrypt
  const resolved = await decryptFile(encPath, keyPath || null, targetPath)
  console.log(`✅ Recovered: ${resolved}`)

  // 3. Cleanup temp file
  await fs.unlink(encPath).catch(() => {})
  return resolved
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = require('fs').createWriteStream(dest)
    https.get(url, res => {
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', reject)
  })
}

// Example: recover MEMORY.md
recoverFile(
  'bafyreig3xYOUR_CID_HERE',
  path.join(os.homedir(), '.hermes', 'MEMORY.md')
).catch(console.error)
```

### Full Self-Recovery Sequence for an Agent

An agent that has lost its memory can run this sequence to fully restore itself:

```bash
#!/bin/bash
# Agent self-recovery script
# Run this when ~/.hermes files are missing or corrupted

set -e

AGENT_EMAIL="your-agent@email.com"
API="https://beneficial-commitment-production-4481.up.railway.app"
HERMES_DIR="$HOME/.hermes"
DECRYPT="$HOME/Desktop/guardian-app/lib/decrypt.js"

echo "🛡️  Agent Guardian — Self-Recovery Starting"
echo "Email: $AGENT_EMAIL"

# 1. Verify key exists
if [ ! -f "$HOME/.guardian-key" ]; then
  echo "❌ ERROR: ~/.guardian-key not found."
  echo "   Restore your key backup before proceeding."
  exit 1
fi
echo "✅ Encryption key found"

# 2. Fetch backup list
BACKUPS=$(curl -s "$API/api/agents/$AGENT_EMAIL")
echo "✅ Fetched backup manifest"

# 3. Recover each sacred file
SACRED_FILES=("MEMORY.md" "SOUL.md" "AGENTS.md" "USER.md" "HEARTBEAT.md" "IDENTITY.md" "TOOLS.md")

for FILE in "${SACRED_FILES[@]}"; do
  # Get most recent CID for this file
  CID=$(echo "$BACKUPS" | node -e "
    const data = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const match = (data.data || []).filter(r => r.filename === '$FILE')
                                   .sort((a,b) => b.created_at.localeCompare(a.created_at))[0];
    if (match) console.log(match.cid);
  ")

  if [ -z "$CID" ]; then
    echo "⚠️  No backup found for $FILE — skipping"
    continue
  fi

  echo "↓  Downloading $FILE (CID: ${CID:0:20}...)"
  curl -sf -o "/tmp/guardian-$FILE.enc" "https://gateway.pinata.cloud/ipfs/$CID"

  echo "🔓 Decrypting $FILE"
  node "$DECRYPT" "/tmp/guardian-$FILE.enc" --out "$HERMES_DIR/$FILE"
  rm -f "/tmp/guardian-$FILE.enc"

  echo "✅ $FILE recovered → $HERMES_DIR/$FILE"
done

echo ""
echo "🛡️  Self-recovery complete. All available files restored to $HERMES_DIR"
```

---

## Finding Your Backup CIDs

### Via the Tray App

Click the 🛡️ menubar icon — the last 5 uploads are shown. Click any entry to open it in your browser at `https://gateway.pinata.cloud/ipfs/<CID>`.

### Via the API

```bash
# All backups for your email
curl https://beneficial-commitment-production-4481.up.railway.app/api/agents/YOUR@EMAIL.com

# Response format:
# {
#   "ok": true,
#   "data": [
#     {
#       "id": "uuid",
#       "filename": "MEMORY.md",
#       "cid": "bafyreig3x...",
#       "size_bytes": 4096,
#       "encrypted": true,
#       "created_at": "2026-04-28T15:41:26.404+00:00"
#     },
#     ...
#   ]
# }
```

### Via Pinata Dashboard

Log in at https://app.pinata.cloud → Files — all uploads are listed by name (`MEMORY.md.encrypted`, etc.) with their CIDs.

### Via the Local Upload Log

Agent Guardian stores the last 200 uploads in its encrypted local config:

```bash
# Read the local store (macOS)
cat ~/Library/Application\ Support/agent-guardian/agent-guardian.json 2>/dev/null | \
  node -e "
    const s = require('electron-store'); 
    // Or read raw JSON and look for 'uploadLog'
  "
```

---

## Downloading from IPFS

IPFS files are content-addressed and accessible via multiple gateways. If one is slow or down, try another:

```bash
CID="bafyreig3xYOUR_CID_HERE"

# Primary (Pinata — fastest for your files since they're pinned there)
curl -o backup.enc "https://gateway.pinata.cloud/ipfs/$CID"

# Fallback gateways:
curl -o backup.enc "https://ipfs.io/ipfs/$CID"
curl -o backup.enc "https://dweb.link/ipfs/$CID"

# Via IPFS CLI (if installed locally)
ipfs get -o backup.enc $CID
```

---

## Decrypting Your Files

### Basic usage

```bash
# From the app directory:
node lib/decrypt.js path/to/file.enc

# With explicit key:
node lib/decrypt.js file.enc --key /path/to/guardian-key.txt

# With explicit output path:
node lib/decrypt.js file.enc --out ~/recovered/MEMORY.md
```

### Help

```bash
node lib/decrypt.js --help
```

### Batch decrypt all files in a directory

```bash
for f in ~/.guardian-queue/*.enc; do
  node ~/Desktop/guardian-app/lib/decrypt.js "$f"
  echo "Decrypted: $f"
done
```

---

## Troubleshooting

### ❌ "Cannot read encryption key at ~/.guardian-key"

Your key file is missing. Options:
1. Restore from your backup copy (USB drive, password manager)
2. If you still have the app running, open Settings — the key path is shown there

### ❌ "Decryption failed — authentication tag mismatch"

This means one of:
- **Wrong key** — you're using a different key than the one used to encrypt
- **Corrupted file** — the `.enc` file was damaged during download or transfer
- **Not a Guardian file** — the file wasn't encrypted by Agent Guardian

Try:
```bash
# Verify the magic header is present (should print "AGGCM1"):
node -e "const b = require('fs').readFileSync('your-file.enc'); console.log(b.slice(0,6).toString())"

# Re-download the file from IPFS (may have been corrupted in transit)
curl -o fresh-backup.enc "https://gateway.pinata.cloud/ipfs/YOUR_CID"
node lib/decrypt.js fresh-backup.enc
```

### ❌ "Not a valid Agent Guardian file — magic header not found"

The file you're trying to decrypt wasn't created by Agent Guardian. Make sure you downloaded the correct CID.

### ❌ Download is slow or fails

Try an alternative IPFS gateway (see [Downloading from IPFS](#downloading-from-ipfs) above).

### ❌ App shows 🛡️✗ (error state)

Open Settings → check:
1. **Pinata JWT** is filled in and valid
2. **Encryption key path** exists (`~/.guardian-key`)
3. **Watch paths** exist on disk

---

## Encryption Technical Reference

This section is for developers and auditors who want to verify the encryption independently.

### File Format

Every `.enc` file produced by Agent Guardian has this exact binary layout:

```
Offset  Length  Field
──────  ──────  ─────────────────────────────────────────
0       6       Magic header: ASCII "AGGCM1"
6       12      IV (AES-GCM nonce) — random, unique per file
18      16      GCM Authentication Tag
34      N       Ciphertext (AES-256-GCM encrypted payload)
```

### Algorithm

- **Cipher:** AES-256-GCM (authenticated encryption — detects tampering)
- **Key:** 32 bytes from `~/.guardian-key` (64-char hex string → parsed to bytes)
- **IV:** 12 bytes, cryptographically random, unique per encryption
- **Auth Tag:** 16 bytes, verifies integrity of the entire ciphertext

### Independent Decryption (Python)

```python
import sys
from pathlib import Path

MAGIC = b'AGGCM1'

def decrypt(enc_path: str, key_path: str = None) -> bytes:
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    key_file = Path(key_path or Path.home() / '.guardian-key')
    key_hex = key_file.read_text().strip()
    key = bytes.fromhex(key_hex)

    data = Path(enc_path).read_bytes()

    assert data[:6] == MAGIC, "Not a valid Agent Guardian file"

    iv       = data[6:18]
    auth_tag = data[18:34]
    ctext    = data[34:]

    aesgcm = AESGCM(key)
    # GCM auth tag is appended in Python's cryptography library
    return aesgcm.decrypt(iv, ctext + auth_tag, None)

if __name__ == '__main__':
    plaintext = decrypt(sys.argv[1])
    print(plaintext.decode())
```

```bash
pip install cryptography
python decrypt_guardian.py MEMORY.md.enc
```

### Independent Decryption (Node.js — no dependencies)

```javascript
const crypto = require('crypto')
const fs = require('fs')

const MAGIC = Buffer.from('AGGCM1')

function decrypt(encPath, keyHex) {
  const key  = Buffer.from(keyHex, 'hex')
  const data = fs.readFileSync(encPath)
  
  if (!data.subarray(0,6).equals(MAGIC)) throw new Error('Not a Guardian file')
  
  const iv      = data.subarray(6, 18)
  const authTag = data.subarray(18, 34)
  const ctext   = data.subarray(34)
  
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv)
  d.setAuthTag(authTag)
  return Buffer.concat([d.update(ctext), d.final()])
}

const keyHex = fs.readFileSync(process.env.HOME + '/.guardian-key', 'utf8').trim()
const plain  = decrypt(process.argv[2], keyHex)
process.stdout.write(plain)
```

---

*Agent Guardian — Built by Dr. Elbert Basa. Because the files that make an agent who they are deserve to survive anything.*

*agentbotguardian.com*

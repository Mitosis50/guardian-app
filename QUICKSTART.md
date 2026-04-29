# 🛡️ Agent Guardian — Quick Start Guide

> Install once. Your agent files are protected forever.

---

## What Is Agent Guardian?

Agent Guardian is a macOS menubar app that silently watches your AI agent files, encrypts them, and backs them up to IPFS — permanently. If your machine dies, your agent's memory, soul, and identity survive.

**The 7 files it protects:**

| File | What it contains |
|------|-----------------|
| `MEMORY.md` | Your agent's persistent memory and learned facts |
| `SOUL.md` | Core identity, values, and personality |
| `AGENTS.md` | Behavior rules and agent configuration |
| `USER.md` | Everything your agent knows about you |
| `HEARTBEAT.md` | Health checks and status |
| `IDENTITY.md` | Who the agent is |
| `TOOLS.md` | Available tools and capabilities |

---

## Installation (5 Minutes)

### Step 1 — Choose Your Plan

Visit [agentbotguardian.com](https://agentbotguardian.com) and pick your tier:

| Plan | Price | Backup Frequency | Storage |
|------|-------|-----------------|---------|
| **Free** | $0 | Twice a month | IPFS |
| **Guardian** | $9/mo | Every night | IPFS |
| **Guardian Pro** | $19/mo | Every 6 hours | IPFS + Arweave |
| **Lifetime** | $149 once | Every hour | IPFS + Arweave |

Click your plan → complete Gumroad checkout → you'll receive a confirmation email.

### Step 2 — Download the App

After purchase, download the correct DMG for your Mac:
- **Apple Silicon (M1/M2/M3/M4):** `Agent Guardian-0.1.0-arm64.dmg`
- **Intel Mac:** `Agent Guardian-0.1.0.dmg`

### Step 3 — Install

1. Open the downloaded `.dmg` file
2. Drag **Agent Guardian** to your Applications folder
3. Open Applications → double-click **Agent Guardian**
4. macOS may show *"unidentified developer"* — click **Cancel**, then go to **System Settings → Privacy & Security → Open Anyway**

You should see a **🛡️ shield icon** in your menubar. Agent Guardian is running.

### Step 4 — Get a Pinata JWT

Agent Guardian uploads to IPFS via Pinata (free account supports up to 1GB):

1. Go to [app.pinata.cloud](https://app.pinata.cloud) → Sign up (free)
2. Click **API Keys** → **New Key** → check **pinFileToIPFS** → Create
3. Copy the **JWT** token

### Step 5 — Configure the App

Click the 🛡️ icon → **Settings…**

Fill in:
- **Watch folder paths** — where your agent files live
  - Default: `~/.hermes` and `~/.openclaw/workspace`
  - Add any folder that contains the 7 sacred files
- **Encryption key path** — leave as `~/.guardian-key` (auto-generated on first run)
- **Pinata JWT** — paste from Step 4
- **Plan tier** — select the tier you purchased

Click **Save Settings**.

### Step 6 — Back Up Your Encryption Key ⚠️

**Do this now. Do not skip.**

```bash
# Open Terminal and run:
cat ~/.guardian-key
```

Copy that 64-character hex string and save it somewhere safe:
- Password manager (1Password, Bitwarden, etc.)
- Printed on paper in a safe
- USB drive kept separately from your Mac

> **If you lose this key, your backups cannot be decrypted — by anyone.**

---

## Daily Use

### The App Is Silent by Design

You don't need to do anything. When you save a sacred file:
1. The tray icon briefly shows **🛡️⬆** (uploading)
2. Returns to **🛡️** when done
3. The tray menu shows your most recent uploads with IPFS links

### Manual Upload

To upload everything in the queue right now:
- Click 🛡️ → **Upload Now**

### Checking Your Backups

Click 🛡️ → the last 5 uploads are listed. Click any to open in your browser.

Or query the API:
```bash
curl https://beneficial-commitment-production-4481.up.railway.app/api/agents/YOUR@EMAIL.com
```

---

## Recovering Your Files

**See the full recovery guide:** `RECOVERY.md` (in this same folder)

### Quick Recovery (30 seconds)

```bash
# 1. Find your CID
curl https://beneficial-commitment-production-4481.up.railway.app/api/agents/YOUR@EMAIL.com

# 2. Download encrypted backup
curl -o MEMORY.md.enc "https://gateway.pinata.cloud/ipfs/YOUR_CID"

# 3. Decrypt
node /Applications/Agent\ Guardian.app/Contents/Resources/app/lib/decrypt.js MEMORY.md.enc

# 4. Move it back
mv MEMORY.md ~/.hermes/MEMORY.md
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| 🛡️✗ red X in tray | Open Settings → check Pinata JWT is filled in |
| Upload Now is greyed out | No files queued — edit a watched file to trigger |
| Files not being backed up | Check watch paths in Settings contain your agent folder |
| Decryption fails | Verify `~/.guardian-key` exists and hasn't changed |

---

## Support

- **Email:** support@agentbotguardian.com
- **Website:** [agentbotguardian.com](https://agentbotguardian.com)
- **Founded by:** Dr. Elbert Basa, M.D.

---

*"The files that make an agent who they are deserve to survive anything."*

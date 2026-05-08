# Arweave Archival Storage Setup

Agent Guardian supports **optional** Arweave archival storage as an additional
layer on top of IPFS/Pinata backups. Arweave transactions are designed for
long-term persistence, but they are **not** a replacement for your local
backups or your self-custody recovery key.

## Security Model

- **Encrypted before upload**: The same AES-256-GCM payload that goes to IPFS
  is uploaded to Arweave. Arweave nodes see only ciphertext.
- **Self-custody key required**: Your `~/.guardian-key` is still required to
  decrypt anything retrieved from Arweave. If you lose the key, the Arweave
  transaction is unrecoverable encrypted data.
- **No plaintext ever leaves your device**.

## Prerequisites

1. An Arweave wallet JWK file (JSON keypair).
2. A small amount of AR tokens in that wallet to pay transaction fees.
   - Fees are proportional to data size. Agent Guardian backups are small
     markdown files (≈ a few KB), so fees are typically tiny.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ARWEAVE_KEYFILE` | Yes | Absolute path to your JWK wallet file. Example: `~/.arweave-wallet.json` |
| `ARWEAVE_WALLET_PATH` | — | Backward-compatible alias for `ARWEAVE_KEYFILE`. |
| `ARWEAVE_HOST` | No | Default: `arweave.net` |
| `ARWEAVE_PORT` | No | Default: `443` |
| `ARWEAVE_PROTOCOL` | No | Default: `https` |

## App Settings

Arweave is currently configured via environment variables or the config store
(`arweaveEnabled`, `arweaveWalletPath`, `arweaveHost`, `arweavePort`,
`arweaveProtocol`). A Settings UI toggle and path field are planned for a
future sprint and are not yet implemented.

## Wallet File Protection

**Never commit your wallet file.** Ensure your `.gitignore` includes:

```gitignore
arweave-wallet*.json
wallet*.json
*.key
*.pem
.env
.env.*
```

Keep the wallet file permission to `0o600`:

```bash
chmod 600 ~/.arweave-wallet.json
```

## How It Works

1. When `arweaveEnabled` is true and a valid wallet path is set, the upload
   orchestrator adds the Arweave provider alongside IPFS.
2. Each encrypted backup file is uploaded to **both** IPFS and Arweave.
3. If Arweave fails (e.g., insufficient funds, network error), IPFS upload
   still proceeds. The failure is logged but does not break the primary path.
4. The upload log stores both the IPFS CID and the Arweave transaction id.

## Recovery

Use the existing Recovery panel or API:

- If a backup has a `cid`, it is retrieved from IPFS gateways.
- If a backup has an `arweaveTxId`, it is retrieved from Arweave gateways.
- In both cases, decryption happens locally with your `~/.guardian-key`.

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| "Arweave wallet path is not configured" | Missing config | Set `ARWEAVE_KEYFILE` (or `ARWEAVE_WALLET_PATH`) or config store |
| "Cannot read Arweave wallet" | Wrong path or permissions | Check path and `chmod 600` the file |
| "Arweave transaction post rejected" | Insufficient AR balance | Fund the wallet with AR tokens |
| "All Arweave gateways failed" | Network or tx not mined yet | Wait a few minutes and retry |

## Important Warnings

- **Key loss = unrecoverable data**. Arweave persistence does not help if you
  lose your `~/.guardian-key`.
- **Not a sole recovery path**. Arweave is an optional archival layer. Keep
  local backups and your recovery key in multiple safe places.
- **Transaction finality is probabilistic**. Like all blockchains, "confirmed"
  status means a number of block confirmations have passed; it is not an
  absolute guarantee.

## Funding a Wallet

You can obtain AR tokens through exchanges or bridges. Only a tiny amount is
needed for small encrypted files. Check your balance before enabling Arweave
in production.

## Verification

Run the smoke test to verify your wallet, balance, and end-to-end flow:

```bash
ARWEAVE_KEYFILE=~/.arweave-wallet.json node scripts/arweave-smoke-test.js
```

The smoke test creates a synthetic file, encrypts it, uploads to Arweave,
polls for confirmation, downloads, decrypts, and compares byte-for-byte.

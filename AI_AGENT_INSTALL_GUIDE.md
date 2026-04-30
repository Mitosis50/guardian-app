# Agent Guardian — AI Agent Install Guide

This file is intentionally plain Markdown so a local AI agent can read it, explain the product to the user, and help configure Agent Guardian safely.

## What Agent Guardian does

Agent Guardian is a macOS menubar app that watches selected local folders for **agent-related Markdown files** and creates encrypted backups. It is designed for AI-agent memory, instructions, skills, plans, notes, and other legitimate agent workspace files.

## Legal and safety disclaimer

Agent Guardian is only for lawful, authorized, agent-related files. Do not use Agent Guardian to store, back up, distribute, conceal, or recover illegal content, stolen data, malware, exploit payloads, unauthorized credentials, copyrighted material you do not have rights to store, or any content that violates applicable law or platform terms.

The user is responsible for choosing appropriate watch folders and for ensuring all backed-up content is legal and authorized.

## Files worth protecting

Ask the user which AI agents they use, then help them add the relevant folders or individual Markdown-heavy directories to Agent Guardian's watch list.

Common examples:

- Hermes Agent memory/skills/config notes:
  - `~/.hermes/`
  - `~/.hermes/skills/`
  - `~/.hermes/plans/`
- OpenClaw / agent workspace files:
  - `~/.openclaw/workspace/`
- Claude / coding-agent project guidance files:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `.cursorrules`
  - `.cursor/rules/`
- User-created agent notes:
  - `MEMORY.md`
  - `SKILL.md`
  - `README.md`
  - `TODO.md`
  - `PLANS.md`
  - project-specific `.md` instruction files

Avoid broad folders like the entire home directory, Downloads, Desktop, or Documents unless the user specifically confirms the scope. Prefer targeted agent folders.

## Installation checklist for an AI helper

1. Confirm the user is on macOS and wants Agent Guardian installed.
2. Open the Agent Guardian app or DMG.
3. In Settings, enter the user's email used for Agent Guardian/Gumroad.
4. Add watch folders that contain legitimate agent-related `.md` files.
5. Confirm the encryption key path, usually:
   - `~/.guardian-key`
6. Help the user back up that encryption key somewhere safe. Without it, encrypted backups cannot be decrypted.
7. Add the user's Pinata JWT only if they explicitly provide it.
8. Click **Save Settings**.
9. Click **Upload Now** or wait for the scheduled cron backup.
10. Confirm health files are present:
    - `~/Library/Application Support/agent-guardian-tray/health.json`
    - `~/Library/Application Support/agent-guardian-tray/logs/cron.log`
11. If asked to recover files, use the Recover Files tab and write recovered files into a user-approved folder.

## Suggested prompt for the user's AI agent

```text
Please read the Agent Guardian AI_AGENT_INSTALL_GUIDE.md file. Help me install/configure Agent Guardian only for lawful, authorized, agent-related Markdown files. Ask me which AI agents I use, identify important .md instruction/memory files, add only those folders to the watch list, and verify health.json and cron.log after setup.
```

## Troubleshooting

- If no files upload, verify the watch folder contains `.md` files and the app has filesystem access.
- If recovery fails, verify the encryption key path points to the same key used when the files were encrypted.
- If `cron.log` is missing, launch Agent Guardian and open Settings once; the app should initialize the health trail.
- If the backend rejects writes, the production API likely requires authenticated client requests.

## Privacy reminders

- The encryption key stays local.
- Do not paste service-role keys into the app.
- Never place private API keys in watch folders unless the user knowingly wants them backed up and has the legal right to do so.
- Agent Guardian should protect agent knowledge, not conceal prohibited content.

#!/bin/bash
# Usage: GUARDIAN_WEBHOOK_SECRET=<secret> bash scripts/run-webhook-proof.sh
# Runs the webhook proof against live Railway API and saves report to Desktop
node scripts/gumroad-webhook-proof.js 2>&1 | tee /Users/aiagents/Desktop/Hero7-Webhook-Proof-Run.log
echo "Report saved to /Users/aiagents/Desktop/Hero7-Webhook-Proof-Run.log"

/**
 * Inbound Email Poller for SUKI CRM (CLI entry point).
 *
 * The polling logic itself lives in lib/inbound-email-service.ts so that the
 * same code path can also be driven over HTTP by /api/cron/email-poll on
 * serverless hosts, which cannot run a long-lived process.
 *
 * Polls the configured Microsoft 365 mailbox via Microsoft Graph API, fetches
 * unread messages, classifies each as "Enquiry" or "General" using rule-based
 * keyword matching, creates an InboundEmailLog record, and auto-creates a Lead
 * for Enquiry emails.
 *
 * Deduplication: uses the Message-ID header (stored as InboundEmailLog.messageId, which has @unique).
 *
 * Usage:
 *   npm run email:poll             # runs once
 *   npm run email:poll -- --watch  # runs on interval (uses INBOUND_POLL_INTERVAL_MS or 120s default)
 *
 * Env vars (already defined in .env):
 *   MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, MS_GRAPH_TENANT_ID, MS_GRAPH_MAILBOX
 *   INTERNAL_COMPANY_ID
 *   INBOUND_POLL_INTERVAL_MS (optional, default 120000)
 *   INBOUND_MAX_MESSAGES_PER_RUN (optional, default 25)
 */

import { config } from "dotenv";

config(); // load .env before anything reads process.env

import { prisma } from "../lib/prisma";
import { pollInboundEmails, defaultMaxMessages } from "../lib/inbound-email-service";

const POLL_INTERVAL = parseInt(process.env.INBOUND_POLL_INTERVAL_MS || "120000");
const MS_GRAPH_MAILBOX = process.env.MS_GRAPH_MAILBOX || "";

const isWatchMode = process.argv.includes("--watch");

/**
 * On the CLI there is no execution-time limit, so process every waiting
 * message in one pass rather than the serverless-friendly default cap.
 */
async function pollOnce() {
  const summary = await pollInboundEmails({
    maxMessages: parseInt(process.env.INBOUND_MAX_MESSAGES_PER_RUN || "0") || Number.MAX_SAFE_INTEGER,
  });

  console.log(
    `[poller] Summary: found=${summary.found} processed=${summary.processed} ` +
      `leads=${summary.leadsCreated} duplicates=${summary.duplicates} ` +
      `remaining=${summary.remaining} errors=${summary.errors.length} (${summary.durationMs}ms)`
  );

  return summary;
}

async function main() {
  console.log("=== SUKI CRM Inbound Email Poller ===");
  console.log(`Mode: ${isWatchMode ? "watch (interval: " + POLL_INTERVAL + "ms)" : "single run"}`);
  console.log(`Mailbox: ${MS_GRAPH_MAILBOX || "(not configured)"}`);
  console.log(`Batch cap: ${defaultMaxMessages()} (HTTP route) / unlimited (CLI)`);
  console.log();

  if (isWatchMode) {
    // Run once immediately, then on interval
    await pollOnce();
    console.log(`\n[poller] Next poll in ${POLL_INTERVAL}ms...`);
    setInterval(async () => {
      try {
        await pollOnce();
      } catch (err: any) {
        console.error(`[poller] Poll cycle error: ${err.message}`);
      }
      console.log(`\n[poller] Next poll in ${POLL_INTERVAL}ms...`);
    }, POLL_INTERVAL);
  } else {
    await pollOnce();
  }
}

main()
  .then(() => {
    if (!isWatchMode) {
      prisma.$disconnect();
    }
  })
  .catch((err) => {
    console.error("[poller] Fatal error:", err);
    prisma.$disconnect();
    process.exit(1);
  });

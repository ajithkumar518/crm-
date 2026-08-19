/**
 * Inbound Email Poller for SUKI CRM.
 *
 * Connects to the configured IMAP mailbox, fetches new (unseen) emails,
 * classifies each as "Enquiry" or "General" using rule-based keyword matching,
 * creates an InboundEmailLog record, and auto-creates a Lead for Enquiry emails.
 *
 * Deduplication: uses the Message-ID header (stored as InboundEmailLog.messageId, which has @unique).
 *
 * Usage:
 *   npm run email:poll          # runs once
 *   npm run email:poll -- --watch  # runs on interval (uses INBOUND_POLL_INTERVAL_MS or 120s default)
 *
 * Env vars (already defined in .env):
 *   IMAP_HOST, IMAP_PORT, IMAP_USER, IMAP_PASS, IMAP_MAILBOX, IMAP_PROCESSED_FOLDER
 *   INTERNAL_COMPANY_ID
 *   INBOUND_POLL_INTERVAL_MS (optional, default 120000)
 */

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { classifyEmail } from "../lib/email-classification";
import { createLeadWithWorkflow, checkLeadDuplicate } from "../lib/leadWorkflow";
import { extractLeadInfoFromEmail } from "../lib/email-extractor";

config(); // load .env

const prisma = new PrismaClient();

const IMAP_HOST = process.env.IMAP_HOST || "imap.gmail.com";
const IMAP_PORT = parseInt(process.env.IMAP_PORT || "993");
const IMAP_USER = process.env.IMAP_USER || "";
const IMAP_PASS = process.env.IMAP_PASS || "";
const IMAP_MAILBOX = process.env.IMAP_MAILBOX || "INBOX";
const IMAP_PROCESSED_FOLDER = process.env.IMAP_PROCESSED_FOLDER || "Processed";
const COMPANY_ID_ENV = process.env.INTERNAL_COMPANY_ID || null;
const POLL_INTERVAL = parseInt(process.env.INBOUND_POLL_INTERVAL_MS || "120000");

// Resolve the actual company ID from the DB (the env var may be stale)
async function getCompanyId(): Promise<string | null> {
  if (COMPANY_ID_ENV) {
    // Verify the env var company exists
    const company = await prisma.company.findUnique({ where: { id: COMPANY_ID_ENV } });
    if (company) return COMPANY_ID_ENV;
  }
  // Fall back to the first company
  const firstCompany = await prisma.company.findFirst();
  return firstCompany?.id || null;
}

const isWatchMode = process.argv.includes("--watch");

async function ensureProcessedFolder(client: ImapFlow) {
  try {
    const lock = await client.getMailboxLock(IMAP_MAILBOX);
    try {
      const mailboxes = await client.list();
      const hasProcessed = mailboxes.some((m: any) => m.path === IMAP_PROCESSED_FOLDER);
      if (!hasProcessed) {
        await client.mailboxCreate(IMAP_PROCESSED_FOLDER);
        console.log(`[poller] Created processed folder: ${IMAP_PROCESSED_FOLDER}`);
      }
    } finally {
      lock.release();
    }
  } catch (err) {
    console.warn(`[poller] Could not ensure processed folder: ${err}`);
  }
}

async function pollOnce() {
  if (!IMAP_USER || !IMAP_PASS) {
    console.error("[poller] IMAP_USER and IMAP_PASS must be set in .env");
    return;
  }

  console.log(`[poller] Connecting to ${IMAP_HOST}:${IMAP_PORT} as ${IMAP_USER}...`);

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: {
      user: IMAP_USER,
      pass: IMAP_PASS,
    },
    logger: false,
  });

  try {
    await client.connect();
    console.log("[poller] Connected.");

    await ensureProcessedFolder(client);

    const lock = await client.getMailboxLock(IMAP_MAILBOX);
    try {
      // Search for unseen messages — returns sequence numbers by default
      const searchResults = await client.search({ seen: false });
      if (!searchResults || searchResults.length === 0) {
        console.log("[poller] No new emails found.");
        return;
      }

      console.log(`[poller] Found ${searchResults.length} new email(s). IDs: ${searchResults.join(", ")}`);

      // Process each message by sequence number
      for (const seq of searchResults) {
        try {
          const msg = await client.fetchOne(String(seq), { source: true, envelope: true, internalDate: true });
          if (!msg) {
            console.warn(`[poller] Seq ${seq}: fetchOne returned null, skipping.`);
            continue;
          }
          await processEmailFromMsg(client, seq, msg);
        } catch (err: any) {
          console.error(`[poller] Error processing seq ${seq}: ${err.message}`);
          // Continue to next email — don't let one bad email crash the poller
        }
      }
    } finally {
      lock.release();
    }
  } catch (err: any) {
    console.error(`[poller] Connection/auth failure: ${err.message}`);
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore logout errors
    }
    console.log("[poller] Disconnected.");
  }
}

async function processEmailFromMsg(client: ImapFlow, uid: number, msg: any) {
  if (!msg || !msg.source) {
    console.warn(`[poller] UID ${uid}: no source data, skipping.`);
    return;
  }

  // Parse with mailparser
  const parsed = await simpleParser(msg.source);

  const messageId = parsed.messageId || `no-message-id-${uid}-${Date.now()}`;
  const fromEmail = parsed.from?.value?.[0]?.address || "unknown@unknown";
  const fromName = parsed.from?.value?.[0]?.name || parsed.from?.text || null;
  const subject = parsed.subject || "";
  const bodyText = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]*>/g, " ") : "") || "";
  const hasAttachments = (parsed.attachments?.length || 0) > 0;
  const receivedDate = parsed.date || msg.internalDate || new Date();

  console.log(`[poller] UID ${uid}: from=${fromEmail}, subject="${subject.substring(0, 60)}"`);

  // Deduplicate by messageId
  const existing = await prisma.inboundEmailLog.findUnique({
    where: { messageId },
  });
  if (existing) {
    console.log(`[poller] Seq ${uid}: duplicate messageId ${messageId}, skipping.`);
    // Mark as seen so we don't fetch it again
    try { await client.messageFlagsAdd(uid, ["\\Seen"]); } catch {}
    return;
  }

  // Classify
  const result = classifyEmail(subject, bodyText);
  console.log(`[poller] UID ${uid}: classified as ${result.classification} (confidence: ${result.confidence}) — ${result.reason}`);

  // Create InboundEmailLog record
  let leadId: string | null = null;
  let status = "Processed";
  let rejectReason: string | null = null;

  // Auto-create Lead for Enquiry emails
  if (result.classification === "Enquiry") {
    try {
      const companyId = await getCompanyId();
      const dup = await checkLeadDuplicate(fromEmail, null);
      if (!dup) {
        // Extract structured information from email
        const extractedInfo = extractLeadInfoFromEmail(subject, bodyText, fromEmail, fromName);

        const lead = await createLeadWithWorkflow({
          name: fromName || fromEmail.split("@")[0],
          email: fromEmail,
          phone: extractedInfo.phone,
          city: extractedInfo.city,
          leadSource: "Email",
          notes: extractedInfo.formattedBody,
          companyId,
          createdById: null, // system-created
          industryType: extractedInfo.industryType,
          estimatedValue: extractedInfo.estimatedValue,
          companyName: extractedInfo.companyName,
          designation: null,
        });
        leadId = lead.lead?.id || null;
        console.log(`[poller] UID ${uid}: auto-created Lead ${lead.lead?.leadCode || lead.lead?.id || "unknown"}`);
        console.log(`[poller] UID ${uid}: Extracted - City: ${extractedInfo.city}, Phone: ${extractedInfo.phone}, Value: ${extractedInfo.estimatedValue}, Industry: ${extractedInfo.industryType}`);
      } else {
        console.log(`[poller] UID ${uid}: duplicate lead (email ${fromEmail} already exists), skipping lead creation.`);
        rejectReason = "Duplicate lead — email already exists in CRM";
      }
    } catch (err: any) {
      console.error(`[poller] UID ${uid}: failed to create lead: ${err.message}`);
      rejectReason = `Lead creation failed: ${err.message}`;
    }
  }

  const log = await prisma.inboundEmailLog.create({
    data: {
      messageId,
      fromEmail,
      fromName,
      subject,
      bodyText: bodyText.slice(0, 10000), // cap body storage
      classification: result.classification,
      classificationReason: result.reason,
      classificationConfidence: result.confidence,
      manuallyOverridden: false,
      status,
      leadId,
      rejectReason,
      hasAttachments,
      receivedAt: receivedDate instanceof Date ? receivedDate : new Date(receivedDate),
      processedAt: new Date(),
    },
  });

  console.log(`[poller] UID ${uid}: created InboundEmailLog ${log.id} → ${result.classification}`);

  // Move to processed folder + mark as seen
  try {
    await client.messageMove(uid, IMAP_PROCESSED_FOLDER);
    console.log(`[poller] Seq ${uid}: moved to ${IMAP_PROCESSED_FOLDER}`);
  } catch (err: any) {
    console.warn(`[poller] Seq ${uid}: could not move to processed folder: ${err.message}`);
    try { await client.messageFlagsAdd(uid, ["\\Seen"]); } catch {}
  }
}

async function main() {
  console.log("=== SUKI CRM Inbound Email Poller ===");
  console.log(`Mode: ${isWatchMode ? "watch (interval: " + POLL_INTERVAL + "ms)" : "single run"}`);
  console.log(`Mailbox: ${IMAP_MAILBOX} on ${IMAP_HOST}:${IMAP_PORT}`);
  console.log(`User: ${IMAP_USER}`);
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

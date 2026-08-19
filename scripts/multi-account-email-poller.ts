/**
 * Multi-Account Inbound Email Poller for SUKI CRM.
 *
 * Supports multiple email accounts (Gmail, Outlook, etc.)
 * Connects to each configured IMAP mailbox, fetches new emails,
 * classifies them, and creates leads for enquiry emails.
 *
 * Usage:
 *   npm run email:poll:multi          # runs once for all accounts
 *   npm run email:poll:multi -- --watch  # runs on interval
 *
 * Env vars (add to .env):
 *   EMAIL_ACCOUNTS=account1,account2  # comma-separated account names
 *   ACCOUNT1_HOST=imap.gmail.com
 *   ACCOUNT1_PORT=993
 *   ACCOUNT1_USER=user@gmail.com
 *   ACCOUNT1_PASS=app_password
 *   ACCOUNT1_MAILBOX=INBOX
 *   ACCOUNT1_PROCESSED_FOLDER=Processed
 *   ACCOUNT2_HOST=outlook.office365.com
 *   ACCOUNT2_PORT=993
 *   ACCOUNT2_USER=user@outlook.com
 *   ACCOUNT2_PASS=password
 *   ACCOUNT2_MAILBOX=INBOX
 *   ACCOUNT2_PROCESSED_FOLDER=Processed
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

interface EmailAccount {
  name: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  mailbox: string;
  processedFolder: string;
}

// Parse email accounts from environment variables
function getEmailAccounts(): EmailAccount[] {
  const accountsEnv = process.env.EMAIL_ACCOUNTS || "";
  if (!accountsEnv) {
    console.error("[poller] EMAIL_ACCOUNTS must be set in .env (comma-separated account names)");
    return [];
  }

  const accountNames = accountsEnv.split(",").map((s) => s.trim());
  const accounts: EmailAccount[] = [];

  for (const name of accountNames) {
    const host = process.env[`${name.toUpperCase()}_HOST`];
    const port = parseInt(process.env[`${name.toUpperCase()}_PORT`] || "993");
    const user = process.env[`${name.toUpperCase()}_USER`];
    const pass = process.env[`${name.toUpperCase()}_PASS`];
    const mailbox = process.env[`${name.toUpperCase()}_MAILBOX`] || "INBOX";
    const processedFolder = process.env[`${name.toUpperCase()}_PROCESSED_FOLDER`] || "Processed";

    if (!host || !user || !pass) {
      console.error(`[poller] Missing config for account ${name}. Required: ${name.toUpperCase()}_HOST, ${name.toUpperCase()}_USER, ${name.toUpperCase()}_PASS`);
      continue;
    }

    accounts.push({ name, host, port, user, pass, mailbox, processedFolder });
  }

  return accounts;
}

const COMPANY_ID_ENV = process.env.INTERNAL_COMPANY_ID || null;
const POLL_INTERVAL = parseInt(process.env.INBOUND_POLL_INTERVAL_MS || "300000"); // 5 minutes default

// Resolve the actual company ID from the DB
async function getCompanyId(): Promise<string | null> {
  if (COMPANY_ID_ENV) {
    const company = await prisma.company.findUnique({ where: { id: COMPANY_ID_ENV } });
    if (company) return COMPANY_ID_ENV;
  }
  const firstCompany = await prisma.company.findFirst();
  return firstCompany?.id || null;
}

const isWatchMode = process.argv.includes("--watch");

async function ensureProcessedFolder(client: ImapFlow, folderName: string) {
  try {
    const mailboxes = await client.list();
    const hasProcessed = mailboxes.some((m: any) => m.path === folderName);
    if (!hasProcessed) {
      await client.mailboxCreate(folderName);
      console.log(`[poller] Created processed folder: ${folderName}`);
    }
  } catch (err) {
    console.warn(`[poller] Could not ensure processed folder: ${err}`);
  }
}

async function pollAccount(account: EmailAccount) {
  console.log(`\n[poller] Processing account: ${account.name} (${account.user})`);
  console.log(`[poller] Connecting to ${account.host}:${account.port}...`);

  const client = new ImapFlow({
    host: account.host,
    port: account.port,
    secure: true,
    auth: {
      user: account.user,
      pass: account.pass,
    },
    logger: false,
  });

  try {
    await client.connect();
    console.log(`[poller] Connected to ${account.name}.`);

    await ensureProcessedFolder(client, account.processedFolder);

    const lock = await client.getMailboxLock(account.mailbox);
    try {
      const searchResults = await client.search({ seen: false });
      if (!searchResults || searchResults.length === 0) {
        console.log(`[poller] No new emails found in ${account.name}.`);
        return;
      }

      console.log(`[poller] Found ${searchResults.length} new email(s) in ${account.name}.`);

      for (const seq of searchResults) {
        try {
          const msg = await client.fetchOne(String(seq), { source: true, envelope: true, internalDate: true });
          if (!msg) {
            console.warn(`[poller] ${account.name} Seq ${seq}: fetchOne returned null, skipping.`);
            continue;
          }
          await processEmailFromMsg(client, account, seq, msg);
        } catch (err: any) {
          console.error(`[poller] ${account.name} Error processing seq ${seq}: ${err.message}`);
        }
      }
    } finally {
      lock.release();
    }
  } catch (err: any) {
    console.error(`[poller] ${account.name} Connection/auth failure: ${err.message}`);
  } finally {
    try {
      await client.logout();
    } catch {
      // ignore logout errors
    }
    console.log(`[poller] Disconnected from ${account.name}.`);
  }
}

async function processEmailFromMsg(client: ImapFlow, account: EmailAccount, uid: number, msg: any) {
  if (!msg || !msg.source) {
    console.warn(`[poller] ${account.name} UID ${uid}: no source data, skipping.`);
    return;
  }

  const parsed = await simpleParser(msg.source);

  const messageId = parsed.messageId || `no-message-id-${account.name}-${uid}-${Date.now()}`;
  const fromEmail = parsed.from?.value?.[0]?.address || "unknown@unknown";
  const fromName = parsed.from?.value?.[0]?.name || parsed.from?.text || null;
  const subject = parsed.subject || "";
  const bodyText = parsed.text || (parsed.html ? parsed.html.replace(/<[^>]*>/g, " ") : "") || "";
  const hasAttachments = (parsed.attachments?.length || 0) > 0;
  const receivedDate = parsed.date || msg.internalDate || new Date();

  console.log(`[poller] ${account.name} UID ${uid}: from=${fromEmail}, subject="${subject.substring(0, 60)}"`);

  // Deduplicate by messageId
  const existing = await prisma.inboundEmailLog.findUnique({
    where: { messageId },
  });
  if (existing) {
    console.log(`[poller] ${account.name} UID ${uid}: duplicate messageId ${messageId}, skipping.`);
    try { await client.messageFlagsAdd(uid, ["\\Seen"]); } catch {}
    return;
  }

  // Classify
  const result = classifyEmail(subject, bodyText);
  console.log(`[poller] ${account.name} UID ${uid}: classified as ${result.classification} (confidence: ${result.confidence})`);

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
          createdById: null,
          industryType: extractedInfo.industryType,
          estimatedValue: extractedInfo.estimatedValue,
          companyName: extractedInfo.companyName,
          designation: null,
        });
        leadId = lead.lead?.id || null;
        console.log(`[poller] ${account.name} UID ${uid}: auto-created Lead ${lead.lead?.leadCode || lead.lead?.id || "unknown"}`);
        console.log(`[poller] ${account.name} UID ${uid}: Extracted - City: ${extractedInfo.city}, Phone: ${extractedInfo.phone}, Value: ${extractedInfo.estimatedValue}, Industry: ${extractedInfo.industryType}`);
      } else {
        console.log(`[poller] ${account.name} UID ${uid}: duplicate lead (email ${fromEmail} already exists), skipping lead creation.`);
        rejectReason = "Duplicate lead — email already exists in CRM";
      }
    } catch (err: any) {
      console.error(`[poller] ${account.name} UID ${uid}: failed to create lead: ${err.message}`);
      rejectReason = `Lead creation failed: ${err.message}`;
    }
  }

  const log = await prisma.inboundEmailLog.create({
    data: {
      messageId,
      fromEmail,
      fromName,
      subject,
      bodyText: bodyText.slice(0, 10000),
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

  console.log(`[poller] ${account.name} UID ${uid}: created InboundEmailLog ${log.id} → ${result.classification}`);

  // Move to processed folder + mark as seen
  try {
    await client.messageMove(uid, account.processedFolder);
    console.log(`[poller] ${account.name} Seq ${uid}: moved to ${account.processedFolder}`);
  } catch (err: any) {
    console.warn(`[poller] ${account.name} Seq ${uid}: could not move to processed folder: ${err.message}`);
    try { await client.messageFlagsAdd(uid, ["\\Seen"]); } catch {}
  }
}

async function pollOnce() {
  const accounts = getEmailAccounts();
  if (accounts.length === 0) {
    console.error("[poller] No email accounts configured. Please set EMAIL_ACCOUNTS in .env");
    return;
  }

  console.log(`[poller] Processing ${accounts.length} email account(s)...`);

  for (const account of accounts) {
    await pollAccount(account);
  }
}

async function main() {
  console.log("=== SUKI CRM Multi-Account Inbound Email Poller ===");
  console.log(`Mode: ${isWatchMode ? "watch (interval: " + POLL_INTERVAL + "ms)" : "single run"}`);
  console.log(`Accounts configured: ${process.env.EMAIL_ACCOUNTS || "none"}`);
  console.log();

  if (isWatchMode) {
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
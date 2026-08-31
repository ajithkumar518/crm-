/**
 * Shared inbound-email polling service for SUKI CRM.
 *
 * Polls a Microsoft 365 mailbox via the Microsoft Graph API, fetches unread
 * messages, classifies them, creates an InboundEmailLog row, and auto-creates
 * a Lead for "Enquiry" mail.
 *
 * Microsoft 365 has disabled Basic Authentication for IMAP, so the previous
 * IMAP/IMAP-flow approach is no longer viable. The Graph API client-credentials
 * flow (Application permissions: Mail.Read, Mail.ReadWrite) is used instead.
 *
 * Env vars:
 *   MS_GRAPH_CLIENT_ID
 *   MS_GRAPH_CLIENT_SECRET
 *   MS_GRAPH_TENANT_ID
 *   MS_GRAPH_MAILBOX                 (e.g. quotationplant2@shahnazbrightsteel.in)
 *   INTERNAL_COMPANY_ID              (optional — falls back to the first company)
 *   INBOUND_MAX_MESSAGES_PER_RUN     (optional, default 25)
 *   NODE_TLS_REJECT_UNAUTHORIZED     (set to "0" only in local test environments
 *                                     behind TLS-inspecting proxies)
 */

import { simpleParser } from "mailparser";
import { prisma } from "./prisma";
import { classifyEmail } from "./email-classification";
import { createLeadWithWorkflow, checkLeadDuplicate } from "./leadWorkflow";
import { extractLeadInfoFromEmail } from "./email-extractor";

export interface PollOptions {
  /** Max messages to handle in this run. Protects serverless timeouts. */
  maxMessages?: number;
  /** Log sink. Defaults to console.log. Pass a no-op to silence. */
  logger?: (message: string) => void;
}

export interface PollResult {
  ok: boolean;
  connected: boolean;
  /** Unseen messages present in the mailbox. */
  found: number;
  /** Messages fully handled in this run. */
  processed: number;
  /** New leads created. */
  leadsCreated: number;
  /** Messages skipped because the Message-ID was already logged. */
  duplicates: number;
  /** Messages left unhandled because maxMessages was reached. */
  remaining: number;
  errors: string[];
  durationMs: number;
}

interface GraphConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  mailbox: string;
  maxMessages: number;
}

/** Read config at call time (not module load) so serverless picks up runtime env. */
function readGraphConfig(): GraphConfig {
  return {
    clientId: process.env.MS_GRAPH_CLIENT_ID || "",
    clientSecret: process.env.MS_GRAPH_CLIENT_SECRET || "",
    tenantId: process.env.MS_GRAPH_TENANT_ID || "",
    mailbox: process.env.MS_GRAPH_MAILBOX || "",
    maxMessages: parseInt(process.env.INBOUND_MAX_MESSAGES_PER_RUN || "25"),
  };
}

export function defaultMaxMessages(): number {
  return parseInt(process.env.INBOUND_MAX_MESSAGES_PER_RUN || "25");
}

/**
 * Resolve the company to attach auto-created leads to.
 * Prefers INTERNAL_COMPANY_ID, but verifies it still exists; otherwise falls
 * back to the first company (the env value may be stale across environments).
 */
async function getCompanyId(): Promise<string | null> {
  const envCompanyId = process.env.INTERNAL_COMPANY_ID || null;
  if (envCompanyId) {
    const company = await prisma.company.findUnique({ where: { id: envCompanyId } });
    if (company) return envCompanyId;
  }
  const firstCompany = await prisma.company.findFirst();
  return firstCompany?.id || null;
}

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

/** Get a Microsoft Graph access token via client credentials flow. */
async function getGraphToken(config: GraphConfig): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.accessToken;
  }

  const url = `https://login.microsoftonline.com/${config.tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("client_id", config.clientId);
  body.set("client_secret", config.clientSecret);
  body.set("scope", "https://graph.microsoft.com/.default");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(`Graph token request failed: ${data?.error_description || data?.error || res.statusText}`);
  }

  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in - 120) * 1000, // 2 min buffer
  };
  return cachedToken.accessToken;
}

/** Make an authenticated Microsoft Graph API request. */
async function graphRequest(
  config: GraphConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getGraphToken(config);
  const url = endpoint.startsWith("http")
    ? endpoint
    : `https://graph.microsoft.com/v1.0/users/${config.mailbox}${endpoint}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
}

/** List unread messages in the Inbox. */
async function listUnreadMessages(
  config: GraphConfig,
  maxMessages: number
): Promise<Array<{ id: string; internetMessageId?: string; receivedDateTime?: string }>> {
  const url =
    `/mailFolders/inbox/messages?$filter=isRead%20eq%20false` +
    `&$top=${maxMessages}` +
    `&$select=id,internetMessageId,receivedDateTime,subject,from,hasAttachments`;

  const res = await graphRequest(config, url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph list messages failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return data.value || [];
}

/** Fetch the raw MIME content of a message. */
async function fetchMessageMime(config: GraphConfig, messageId: string): Promise<Buffer> {
  const res = await graphRequest(config, `/messages/${messageId}/$value`, {
    headers: { Accept: "text/plain" },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph fetch MIME failed: ${res.status} ${text}`);
  }
  const text = await res.text();
  return Buffer.from(text, "binary");
}

/** Mark a message as read so it is not processed again. */
async function markMessageRead(config: GraphConfig, messageId: string): Promise<void> {
  const res = await graphRequest(config, `/messages/${messageId}`, {
    method: "PATCH",
    body: JSON.stringify({ isRead: true }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Graph mark read failed: ${res.status} ${text}`);
  }
}

/**
 * Poll the Microsoft 365 mailbox, process up to `maxMessages` unread emails,
 * classify them, and auto-create leads for enquiries.
 * Never throws — all failures are captured in the returned result.
 */
export async function pollInboundEmails(options: PollOptions = {}): Promise<PollResult> {
  const startedAt = Date.now();
  const log = options.logger ?? ((m: string) => console.log(m));
  const cfg = readGraphConfig();
  const maxMessages = options.maxMessages ?? cfg.maxMessages;

  const result: PollResult = {
    ok: false,
    connected: false,
    found: 0,
    processed: 0,
    leadsCreated: 0,
    duplicates: 0,
    remaining: 0,
    errors: [],
    durationMs: 0,
  };

  if (!cfg.clientId || !cfg.clientSecret || !cfg.tenantId || !cfg.mailbox) {
    result.errors.push(
      "MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, MS_GRAPH_TENANT_ID, and MS_GRAPH_MAILBOX must be set"
    );
    log("[poller] Microsoft Graph credentials are not configured in .env");
    result.durationMs = Date.now() - startedAt;
    return result;
  }

  log(`[poller] Connecting to Microsoft 365 mailbox ${cfg.mailbox} via Graph API...`);

  try {
    // Getting a token proves connectivity.
    await getGraphToken(cfg);
    result.connected = true;
    log("[poller] Authenticated to Microsoft Graph.");

    const messages = await listUnreadMessages(cfg, maxMessages);
    result.found = messages.length;

    if (messages.length === 0) {
      log("[poller] No new emails found.");
      result.ok = true;
      result.durationMs = Date.now() - startedAt;
      return result;
    }

    log(`[poller] Found ${messages.length} new email(s); processing up to ${maxMessages}.`);

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];
      try {
        const outcome = await processEmailFromGraph(cfg, message, log);
        result.processed++;
        if (outcome.duplicate) result.duplicates++;
        if (outcome.leadCreated) result.leadsCreated++;
      } catch (err: any) {
        const msg = `Message ${message.id}: ${err.message}`;
        result.errors.push(msg);
        log(`[poller] Error processing ${msg}`);
        // Continue — one bad email must not abort the run.
      }
      if (i === maxMessages - 1 && messages.length > maxMessages) {
        result.remaining = messages.length - maxMessages;
      }
    }

    result.ok = true;
  } catch (err: any) {
    result.errors.push(`Connection/auth failure: ${err.message}`);
    log(`[poller] Connection/auth failure: ${err.message}`);
  } finally {
    result.durationMs = Date.now() - startedAt;
  }

  return result;
}

interface ProcessOutcome {
  duplicate: boolean;
  leadCreated: boolean;
}

async function processEmailFromGraph(
  config: GraphConfig,
  message: { id: string; internetMessageId?: string; receivedDateTime?: string },
  log: (m: string) => void
): Promise<ProcessOutcome> {
  const outcome: ProcessOutcome = { duplicate: false, leadCreated: false };

  const source = await fetchMessageMime(config, message.id);
  const parsed = await simpleParser(source);

  const messageId =
    parsed.messageId ||
    message.internetMessageId ||
    `no-message-id-${message.id}-${Date.now()}`;
  const fromEmail = parsed.from?.value?.[0]?.address || "unknown@unknown";
  const fromName = parsed.from?.value?.[0]?.name || parsed.from?.text || null;
  const subject = parsed.subject || "";
  const bodyText =
    parsed.text || (parsed.html ? parsed.html.replace(/<[^>]*>/g, " ") : "") || "";
  const hasAttachments = (parsed.attachments?.length || 0) > 0;
  const receivedDate =
    parsed.date || (message.receivedDateTime ? new Date(message.receivedDateTime) : new Date());

  log(`[poller] MSG ${message.id}: from=${fromEmail}, subject="${subject.substring(0, 60)}"`);

  // Deduplicate by Message-ID (InboundEmailLog.messageId is @unique)
  const existing = await prisma.inboundEmailLog.findUnique({ where: { messageId } });
  if (existing) {
    log(`[poller] MSG ${message.id}: duplicate messageId ${messageId}, skipping.`);
    outcome.duplicate = true;
    try {
      await markMessageRead(config, message.id);
    } catch {}
    return outcome;
  }

  const result = classifyEmail(subject, bodyText);
  log(
    `[poller] MSG ${message.id}: classified as ${result.classification} (confidence: ${result.confidence}) — ${result.reason}`
  );

  let leadId: string | null = null;
  const status = "Processed";
  let rejectReason: string | null = null;

  // Auto-create Lead for Enquiry emails
  if (result.classification === "Enquiry") {
    try {
      const companyId = await getCompanyId();
      const dup = await checkLeadDuplicate(fromEmail, null);
      if (!dup) {
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
        outcome.leadCreated = Boolean(leadId);
        log(
          `[poller] MSG ${message.id}: auto-created Lead ${lead.lead?.leadCode || lead.lead?.id || "unknown"}`
        );
        log(
          `[poller] MSG ${message.id}: Extracted - City: ${extractedInfo.city}, Phone: ${extractedInfo.phone}, Value: ${extractedInfo.estimatedValue}, Industry: ${extractedInfo.industryType}`
        );
      } else {
        log(
          `[poller] MSG ${message.id}: duplicate lead (email ${fromEmail} already exists), skipping lead creation.`
        );
        rejectReason = "Duplicate lead — email already exists in CRM";
      }
    } catch (err: any) {
      log(`[poller] MSG ${message.id}: failed to create lead: ${err.message}`);
      rejectReason = `Lead creation failed: ${err.message}`;
    }
  }

  const logRow = await prisma.inboundEmailLog.create({
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

  log(`[poller] MSG ${message.id}: created InboundEmailLog ${logRow.id} → ${result.classification}`);

  // Mark as read so it is not processed again.
  try {
    await markMessageRead(config, message.id);
    log(`[poller] MSG ${message.id}: marked as read`);
  } catch (err: any) {
    log(`[poller] MSG ${message.id}: could not mark as read: ${err.message}`);
  }

  return outcome;
}

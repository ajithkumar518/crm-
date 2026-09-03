/**
 * Inject a test email with a DUPLICATE Message-ID to test dedup.
 */
import { ImapFlow } from "imapflow";
import { config } from "dotenv";
config();

const IMAP_HOST = process.env.IMAP_HOST || "imap.gmail.com";
const IMAP_PORT = parseInt(process.env.IMAP_PORT || "993");
const IMAP_USER = process.env.IMAP_USER || "";
const IMAP_PASS = process.env.IMAP_PASS || "";
const IMAP_MAILBOX = process.env.IMAP_MAILBOX || "INBOX";

// Use a Message-ID that already exists in the DB
const DUPLICATE_MESSAGE_ID = "<test-enquiry-1-1786693224315@suki-crm-test.local>";

const raw = [
  `From: customer1@testcompany.com (Test Customer 1)`,
  `To: ${IMAP_USER}`,
  `Subject: DUPLICATE TEST - Should be skipped`,
  `Date: ${new Date().toUTCString()}`,
  `Message-ID: ${DUPLICATE_MESSAGE_ID}`,
  `MIME-Version: 1.0`,
  `Content-Type: text/plain; charset=utf-8`,
  ``,
  `This email has a duplicate Message-ID and should be skipped by the poller.`,
].join("\r\n");

async function main() {
  const client = new ImapFlow({
    host: IMAP_HOST, port: IMAP_PORT, secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false,
  });
  await client.connect();
  await client.append(IMAP_MAILBOX, Buffer.from(raw, "utf-8"), ["\\Recent"]);
  console.log(`Injected duplicate email with Message-ID: ${DUPLICATE_MESSAGE_ID}`);
  await client.logout();
}
main().catch(console.error);

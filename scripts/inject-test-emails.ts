/**
 * Inject test emails directly into the IMAP mailbox (bypasses SMTP).
 * This simulates receiving real emails for poller testing.
 * Run: npx tsx scripts/inject-test-emails.ts
 */
import { ImapFlow } from "imapflow";
import { config } from "dotenv";

config();

const IMAP_HOST = process.env.IMAP_HOST || "imap.gmail.com";
const IMAP_PORT = parseInt(process.env.IMAP_PORT || "993");
const IMAP_USER = process.env.IMAP_USER || "";
const IMAP_PASS = process.env.IMAP_PASS || "";
const IMAP_MAILBOX = process.env.IMAP_MAILBOX || "INBOX";

const testEmails = [
  {
    label: "Enquiry (material grade + quantity + quotation)",
    messageId: `<test-enquiry-1-${Date.now()}@suki-crm-test.local>`,
    from: "customer1@testcompany.com (Test Customer 1)",
    subject: "Requirement for SS304 Round Bar 50mm - 500 Kgs",
    body: "Dear Sir,\n\nWe require SS304 round bar 50mm diameter, 500 kgs.\nPlease send quotation with price and delivery time.\n\nRegards,\nTest Customer 1",
  },
  {
    label: "General (thank you note)",
    messageId: `<test-general-1-${Date.now()}@suki-crm-test.local>`,
    from: "someone@othercompany.com (John Smith)",
    subject: "Thank you for the meeting",
    body: "Hi,\n\nThank you for taking the time to meet with us yesterday.\nIt was great discussing the project.\n\nBest regards,\nJohn",
  },
  {
    label: "Ambiguous (meeting + pricing request)",
    messageId: `<test-ambiguous-1-${Date.now()}@suki-crm-test.local>`,
    from: "prospect@business.com (Prospect)",
    subject: "Follow up on our discussion about steel requirements",
    body: "Hi,\n\nFollowing up on our meeting last week. Could you send me the pricing for the materials we discussed?\n\nThanks",
  },
];

function buildRawEmail(email: typeof testEmails[0]): string {
  const date = new Date().toUTCString();
  return [
    `From: ${email.from}`,
    `To: ${IMAP_USER}`,
    `Subject: ${email.subject}`,
    `Date: ${date}`,
    `Message-ID: ${email.messageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    email.body,
  ].join("\r\n");
}

async function main() {
  console.log(`Connecting to ${IMAP_HOST}:${IMAP_PORT} as ${IMAP_USER}...`);

  const client = new ImapFlow({
    host: IMAP_HOST,
    port: IMAP_PORT,
    secure: true,
    auth: { user: IMAP_USER, pass: IMAP_PASS },
    logger: false,
  });

  await client.connect();
  console.log("Connected.\n");

  for (const email of testEmails) {
    const raw = buildRawEmail(email);
    // Append as unseen (\\Recent flag, no \\Seen)
    await client.append(IMAP_MAILBOX, Buffer.from(raw, "utf-8"), ["\\Recent"]);
    console.log(`Injected [${email.label}]: ${email.subject}`);
    console.log(`  Message-ID: ${email.messageId}`);
  }

  await client.logout();
  console.log("\nAll test emails injected. Run the poller now.");
}

main().catch((err) => { console.error("Error:", err); process.exit(1); });

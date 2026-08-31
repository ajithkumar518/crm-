/**
 * Verify the test email actually arrived in the testsuki66@gmail.com inbox
 * by connecting via IMAP (using imapflow, same lib as the poller) and searching
 * for the quotation subject.
 */
import { config } from "dotenv";
config();
import { ImapFlow } from "imapflow";

async function main() {
  const subject = "Quotation QT-TEST-2026-00001 from";

  const client = new ImapFlow({
    host: process.env.IMAP_HOST || "imap.gmail.com",
    port: Number(process.env.IMAP_PORT) || 993,
    secure: true,
    auth: {
      user: process.env.IMAP_USER!,
      pass: process.env.IMAP_PASS!,
    },
    logger: false,
    tls: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log("Connected to IMAP");

  // Search INBOX
  let lock = await client.getMailboxLock("INBOX");
  try {
    const uids = await client.search({ subject });
    console.log(`\nINBOX: Found ${uids.length} email(s) matching subject "${subject}"`);

    for (const uid of uids) {
      const msg = await client.fetchOne(uid, { envelope: true, internalDate: true });
      console.log(`\n--- Email UID=${uid} ---`);
      console.log(`  Subject: ${msg.envelope.subject}`);
      console.log(`  From: ${msg.envelope.from?.[0]?.address}`);
      console.log(`  To: ${msg.envelope.to?.[0]?.address}`);
      console.log(`  Date: ${msg.envelope.date}`);
      console.log(`  Internal Date: ${msg.internalDate}`);
    }
  } finally {
    lock.release();
  }

  // Also check Processed folder (in case Gmail filtered it)
  try {
    lock = await client.getMailboxLock("Processed");
    try {
      const uids2 = await client.search({ subject });
      console.log(`\nProcessed: Found ${uids2.length} email(s) matching subject`);
      for (const uid of uids2) {
        const msg = await client.fetchOne(uid, { envelope: true, internalDate: true });
        console.log(`\n--- Email UID=${uid} ---`);
        console.log(`  Subject: ${msg.envelope.subject}`);
        console.log(`  From: ${msg.envelope.from?.[0]?.address}`);
        console.log(`  Date: ${msg.envelope.date}`);
      }
    } finally {
      lock.release();
    }
  } catch (e: any) {
    console.log(`Processed folder check skipped: ${e.message}`);
  }

  await client.logout();
  console.log("\n=== IMAP verification complete ===");
  process.exit(0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

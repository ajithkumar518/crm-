/**
 * Diagnostic: attempt a real SMTP send via the existing lib/email.ts transporter.
 * Captures the exact SMTP response (or error) to confirm root cause.
 */
import { config } from "dotenv";
config();
import nodemailer from "nodemailer";

async function main() {
  console.log("=== SMTP Diagnostic ===\n");

  // Check env vars
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com";
  const smtpPort = Number(process.env.SMTP_PORT || process.env.EMAIL_PORT) || 587;
  const smtpFrom = process.env.SMTP_FROM || process.env.EMAIL_FROM || '"Shahnaz CRM" <noreply@sukisoftware.com>';

  console.log(`SMTP_HOST: ${smtpHost}`);
  console.log(`SMTP_PORT: ${smtpPort}`);
  console.log(`SMTP_USER: ${smtpUser || "(NOT SET)"}`);
  console.log(`SMTP_PASS: ${smtpPass ? "***" + smtpPass.slice(-4) : "(NOT SET)"}`);
  console.log(`SMTP_FROM: ${smtpFrom}`);
  console.log();

  if (!smtpUser || !smtpPass) {
    console.log("[FAIL] SMTP_USER or SMTP_PASS is not set — sendEmail would silently mock");
    process.exit(1);
  }

  // Create a fresh transporter (same config as lib/email.ts)
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    auth: { user: smtpUser, pass: smtpPass },
  });

  // Test 1: Verify connection (auth check)
  console.log("--- Test 1: SMTP connection verification ---");
  try {
    await transporter.verify();
    console.log("[PASS] SMTP connection verified — credentials are valid");
  } catch (err: any) {
    console.log("[FAIL] SMTP connection verification failed:", err.message);
    console.log("  Code:", err.code);
    console.log("  Response:", err.response);
    console.log("  ResponseCode:", err.responseCode);
    process.exit(1);
  }

  // Test 2: Actually send a test email to the same Gmail account (self-send for checkability)
  console.log("\n--- Test 2: Real email send (self-send to testsuki66@gmail.com) ---");
  const testSubject = `Shahnaz CRM Diagnostic Test — ${new Date().toISOString()}`;
  try {
    const info = await transporter.sendMail({
      from: smtpFrom,
      to: "testsuki66@gmail.com",
      subject: testSubject,
      html: `<p>This is a diagnostic test email from Shahnaz CRM. Sent at ${new Date().toISOString()}.</p>`,
    });
    console.log("[PASS] Email sent successfully");
    console.log("  Message ID:", info.messageId);
    console.log("  Response:", info.response);
    console.log("  Envelope:", JSON.stringify(info.envelope));
    console.log("  Accepted:", info.accepted);
    console.log("  Rejected:", info.rejected);
  } catch (err: any) {
    console.log("[FAIL] Email send failed:", err.message);
    console.log("  Code:", err.code);
    console.log("  Response:", err.response);
    console.log("  ResponseCode:", err.responseCode);
  }

  process.exit(0);
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });

/**
 * Send test emails to the monitored inbox for poller testing.
 * Run: npx tsx scripts/send-test-emails.ts
 */
import nodemailer from "nodemailer";
import { config } from "dotenv";

config(); // load .env

const SMTP_USER = process.env.SMTP_USER || "testsuki66@gmail.com";
const SMTP_PASS = process.env.INBOUND_EMAIL_PASS || process.env.SMTP_PASS || "";

async function main() {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });

  const testEmails = [
    {
      subject: "TEST-POLLER: Requirement for SS304 Round Bar 50mm - 500 Kgs",
      text: "Dear Sir, We require SS304 round bar 50mm diameter, 500 kgs. Please send quotation with price and delivery time. Regards, Test Customer",
      label: "Enquiry",
    },
    {
      subject: "TEST-POLLER: Thank you for the meeting",
      text: "Hi, Thank you for taking the time to meet with us yesterday. It was great discussing the project. Best regards, John",
      label: "General",
    },
    {
      subject: "TEST-POLLER: Follow up on our discussion about steel requirements",
      text: "Hi, Following up on our meeting last week. Could you send me the pricing for the materials we discussed? Thanks",
      label: "Ambiguous (expected Enquiry)",
    },
  ];

  for (const email of testEmails) {
    const info = await transporter.sendMail({
      from: SMTP_USER,
      to: SMTP_USER, // send to self (the monitored inbox)
      subject: email.subject,
      text: email.text,
    });
    console.log(`Sent [${email.label}]: ${email.subject} → messageId: ${info.messageId}`);
  }

  console.log("\nAll test emails sent. Wait 10-20s for delivery, then run the poller.");
}

main().catch(console.error);

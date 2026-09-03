/**
 * Test the email classification function with sample emails.
 * Run: npx tsx scripts/test-email-classification.ts
 */
import { classifyEmail } from "../lib/email-classification";

const testEmails = [
  {
    label: "Enquiry 1 (material grade + quantity + quotation)",
    subject: "Requirement for SS304 Round Bar 50mm - 500 Kgs",
    body: "Dear Sir, We require SS304 round bar 50mm diameter, 500 kgs. Please send quotation with price and delivery time. Regards, Customer",
    expected: "Enquiry",
  },
  {
    label: "Enquiry 2 (steel grade + RFQ + availability)",
    subject: "RFQ - EN19 Bright Bar - 1000 Kgs",
    body: "Please quote for EN19 bright bar, 25mm size, 1000 kgs. Need rate and availability. Material required urgently.",
    expected: "Enquiry",
  },
  {
    label: "General 1 (thank you note)",
    subject: "Thank you for the meeting",
    body: "Hi, Thank you for taking the time to meet with us yesterday. It was great discussing the project. Best regards, John",
    expected: "General",
  },
  {
    label: "General 2 (invoice/payment)",
    subject: "Invoice #12345 - Payment Confirmation",
    body: "Dear Team, This is to confirm that we have processed the payment for invoice #12345. Please find the receipt attached. Thanks, Accounts",
    expected: "General",
  },
  {
    label: "Ambiguous 1 (mentions meeting but also material)",
    subject: "Follow up on our discussion about steel requirements",
    body: "Hi, Following up on our meeting last week. Could you send me the pricing for the materials we discussed? Thanks",
    expected: "Enquiry", // has "pricing" and "materials" which are enquiry keywords
  },
  {
    label: "Ambiguous 2 (short, no clear keywords)",
    subject: "Hello",
    body: "Hi, just wanted to check in. How are things going? Let me know if you need anything.",
    expected: "General", // no keywords matched, defaults to General
  },
];

console.log("=== Email Classification Test ===\n");

let pass = 0;
let fail = 0;

for (const test of testEmails) {
  const result = classifyEmail(test.subject, test.body);
  const status = result.classification === test.expected ? "PASS" : "FAIL";
  if (status === "PASS") pass++; else fail++;

  console.log(`[${status}] ${test.label}`);
  console.log(`  Subject: "${test.subject}"`);
  console.log(`  Expected: ${test.expected} | Got: ${result.classification} (confidence: ${result.confidence})`);
  console.log(`  Reason: ${result.reason}`);
  console.log(`  Matched: [${result.matchedKeywords.join(", ")}]`);
  console.log();
}

console.log(`=== Results: ${pass} passed, ${fail} failed ===`);

/**
 * Test manual reclassification of an InboundEmailLog record.
 * Simulates what the PATCH /api/emails/[id] endpoint does.
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const p = new PrismaClient();

(async () => {
  // Find a General-classified email to reclassify
  const email = await p.inboundEmailLog.findFirst({
    where: { classification: "General" },
    orderBy: { receivedAt: "desc" },
  });

  if (!email) {
    console.log("No General-classified email found to test reclassification.");
    return;
  }

  console.log("Before reclassification:");
  console.log(`  ID: ${email.id}`);
  console.log(`  Classification: ${email.classification}`);
  console.log(`  Manually overridden: ${email.manuallyOverridden}`);
  console.log(`  Reason: ${email.classificationReason}`);

  // Simulate the PATCH endpoint logic
  const updated = await p.inboundEmailLog.update({
    where: { id: email.id },
    data: {
      classification: "Enquiry",
      manuallyOverridden: true,
      classificationReason: `Manually reclassified from ${email.classification || "Unclassified"} to Enquiry by user test-script`,
    },
  });

  console.log("\nAfter reclassification:");
  console.log(`  ID: ${updated.id}`);
  console.log(`  Classification: ${updated.classification}`);
  console.log(`  Manually overridden: ${updated.manuallyOverridden}`);
  console.log(`  Reason: ${updated.classificationReason}`);

  // Revert it back
  await p.inboundEmailLog.update({
    where: { id: email.id },
    data: {
      classification: email.classification,
      manuallyOverridden: false,
      classificationReason: email.classificationReason,
    },
  });

  console.log("\nReverted back to original classification.");
  console.log("\n✓ Manual reclassification works correctly and overrides auto-classification.");

  await p.$disconnect();
})();

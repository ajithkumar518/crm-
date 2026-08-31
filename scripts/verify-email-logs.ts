import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const p = new PrismaClient();
(async () => {
  const logs = await p.inboundEmailLog.findMany({
    orderBy: { receivedAt: "desc" },
    take: 10,
    include: { lead: { select: { id: true, leadCode: true, name: true } } },
  });
  console.log("=== InboundEmailLog records ===\n");
  for (const log of logs) {
    console.log(`ID: ${log.id}`);
    console.log(`  From: ${log.fromEmail}`);
    console.log(`  Subject: ${log.subject}`);
    console.log(`  Classification: ${log.classification} (confidence: ${log.classificationConfidence})`);
    console.log(`  Reason: ${log.classificationReason}`);
    console.log(`  Manually overridden: ${log.manuallyOverridden}`);
    console.log(`  Status: ${log.status}`);
    console.log(`  Lead: ${log.lead ? `${log.lead.leadCode} - ${log.lead.name}` : "none"}`);
    console.log(`  Message-ID: ${log.messageId}`);
    console.log();
  }
  await p.$disconnect();
})();

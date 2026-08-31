import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  await p.quotationStatusHistory.deleteMany({ where: { notes: { contains: "Test: set to" } } });
  await p.quotation.deleteMany({ where: { quotationCode: { contains: "TEST-STATUS" } } });
  console.log("Cleaned up test quotations");
  await p.$disconnect();
})();

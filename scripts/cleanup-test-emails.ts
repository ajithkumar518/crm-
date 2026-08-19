import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const p = new PrismaClient();
(async () => {
  const deleted = await p.inboundEmailLog.deleteMany({
    where: { OR: [
      { fromEmail: { contains: "testcompany.com" } },
      { fromEmail: { contains: "business.com" } },
      { fromEmail: { contains: "othercompany.com" } },
    ] },
  });
  console.log("Deleted test InboundEmailLog records:", deleted.count);

  const deletedLeads = await p.lead.deleteMany({
    where: { OR: [
      { email: { contains: "testcompany.com" } },
      { email: { contains: "business.com" } },
      { email: { contains: "othercompany.com" } },
    ] },
  });
  console.log("Deleted test leads:", deletedLeads.count);

  await p.$disconnect();
})();

import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
config();
const p = new PrismaClient();
(async () => {
  const c = await p.company.findFirst();
  console.log("Company ID:", c?.id, "| Name:", c?.name);
  console.log("INTERNAL_COMPANY_ID env:", process.env.INTERNAL_COMPANY_ID);
  await p.$disconnect();
})();

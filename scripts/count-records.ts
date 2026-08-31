import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const u = await p.user.count();
  const l = await p.lead.count();
  const c = await p.customer.count();
  const d = await p.deal.count();
  const co = await p.company.count();
  console.log("Companies:", co, "Users:", u, "Leads:", l, "Customers:", c, "Deals:", d);
  // Check for seed-complete specific emails
  const seedUsers = await p.user.findMany({
    where: { email: { contains: "sukisoftware.com" } },
    select: { email: true, name: true, role: true },
  });
  console.log("\nUsers with sukisoftware.com email:", seedUsers.length);
  seedUsers.forEach((u) => console.log("  ", u.email, u.role));
  await p.$disconnect();
})();

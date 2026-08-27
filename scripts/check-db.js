const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.proformaInvoice.findFirst({ where: { proformaNumber: "PF-2026-00004" } });
  console.log("PF-2026-00004 Terms:");
  console.log(p.termsAndConditions);
  
  // also let's look at the newest proforma
  const pNew = await prisma.proformaInvoice.findFirst({ orderBy: { createdAt: 'desc' } });
  console.log("Newest Proforma:", pNew.proformaNumber);
  console.log("Transport Charge:", pNew.transportCharge);
  console.log("Other Charges:", pNew.otherCharges);
  console.log("Grand Total:", pNew.grandTotal);
}
main().finally(() => prisma.$disconnect());

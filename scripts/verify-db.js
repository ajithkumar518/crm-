const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function run() {
  const all = await prisma.proformaInvoice.findMany({ orderBy: { createdAt: "asc" } });
  if (all.length > 0) {
    console.log("---- OLD RECORD (Backfilled) ----");
    console.log("ID:", all[0].id);
    console.log("Terms:", JSON.stringify(all[0].termsAndConditions));
    console.log("Decl:", JSON.stringify(all[0].declaration));
    
    console.log("\n---- NEWEST RECORD ----");
    const newest = all[all.length - 1];
    console.log("ID:", newest.id);
    console.log("Terms:", JSON.stringify(newest.termsAndConditions));
    console.log("Decl:", JSON.stringify(newest.declaration));
    console.log("Transport:", newest.transportCharge);
    console.log("Other:", newest.otherCharges);
    console.log("Weighing:", newest.weighingLoadingCharge);
    console.log("Delivery:", newest.deliveryCharge);
    console.log("Testing:", newest.testingCharge);
    console.log("GrandTotal:", newest.grandTotal);
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const correctTerms = `1. All reports shortage must reach within 3 days and about defective supply if any within 10 days from date of delivery in writing no claim will be acceptable by us thereafter.\n2. Rejection of material will be acceptable only in original shape of out supply (not after machining & cutting hardening)\n3. All disputes are subject to Chennai Jurisdiction only.\n4. Interest @24% will be charged on all over due bills.`;
  const correctDecl = `Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged and that there is no flow of additional consideration directly or indirectly from the buyer.`;
  
  const updated = await prisma.proformaInvoice.updateMany({
    data: {
      termsAndConditions: correctTerms,
      declaration: correctDecl,
    },
  });
  console.log(`Updated ${updated.count} proforma records.`);
}
main().catch(console.error).finally(() => prisma.$disconnect());

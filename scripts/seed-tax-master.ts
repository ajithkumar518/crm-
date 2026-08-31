import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TAX_RATES = [
  { taxName: "GST 5%",   taxPercent: 5,  hsnCode: null },
  { taxName: "GST 12%",  taxPercent: 12, hsnCode: null },
  { taxName: "GST 18%",  taxPercent: 18, hsnCode: null },
  { taxName: "GST 28%",  taxPercent: 28, hsnCode: null },
  { taxName: "IGST 18%", taxPercent: 18, hsnCode: null },
];

async function main() {
  for (const rate of TAX_RATES) {
    const existing = await prisma.taxMaster.findFirst({
      where: { taxName: rate.taxName, companyId: null },
    });
    if (!existing) {
      await prisma.taxMaster.create({
        data: { ...rate, isActive: true, effectiveFrom: new Date(), companyId: null },
      });
      console.log(`✅ Seeded: ${rate.taxName}`);
    } else {
      console.log(`⏭  Already exists: ${rate.taxName}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

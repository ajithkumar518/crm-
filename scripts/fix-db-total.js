const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const proformas = await prisma.proformaInvoice.findMany();
  for (const p of proformas) {
    const extraCharges = (p.transportCharge || 0) + (p.otherCharges || 0) + (p.weighingLoadingCharge || 0) + (p.deliveryCharge || 0) + (p.testingCharge || 0);
    const discountAmount = p.subtotal * ((p.discountPercent || 0) / 100);
    const expected = p.subtotal - discountAmount + p.taxAmount + extraCharges + (p.roundedOff || 0);
    if (p.grandTotal !== expected) {
      console.log(`Fixing Proforma ${p.id}: ${p.grandTotal} -> ${expected}`);
      await prisma.proformaInvoice.update({
        where: { id: p.id },
        data: { grandTotal: expected }
      });
    }
  }
}
run().finally(() => prisma.$disconnect());

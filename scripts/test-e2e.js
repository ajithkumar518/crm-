const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function check() {
  const p = await prisma.proformaInvoice.findFirst({ orderBy: { createdAt: 'desc' }});
  
  // What happens when items are saved?
  // It updates the DB grandTotal WITHOUT charges.
  const allItems = await prisma.proformaInvoiceItem.findMany({ where: { proformaId: p.id } });
  let subtotal = 0;
  let taxAmount = 0;
  for (const it of allItems) {
    const lineTaxable = it.lineTotal;
    subtotal += lineTaxable;
    taxAmount += lineTaxable * ((it.taxPercent || 0) / 100);
  }
  const discountAmount = subtotal * (p.discountPercent / 100);
  const extraCharges =
    (p.transportCharge || 0) +
    (p.otherCharges || 0) +
    (p.weighingLoadingCharge || 0) +
    (p.deliveryCharge || 0) +
    (p.testingCharge || 0);
  const roundedOff = p.roundedOff || 0;
  const grandTotal = subtotal - discountAmount + taxAmount + extraCharges + roundedOff;

  console.log("After PATCH items:");
  console.log("extraCharges:", extraCharges);
  console.log("grandTotal:", grandTotal);
}

check();

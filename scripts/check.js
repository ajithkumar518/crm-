const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const proforma = await prisma.proformaInvoice.findFirst({ orderBy: { createdAt: 'desc' }, include: { items: true } });
  console.log(JSON.stringify(proforma, null, 2));
}
run().finally(() => prisma.$disconnect());

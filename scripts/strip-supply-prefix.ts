import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * One-time cleanup: strips the "Supply - " prefix that was previously
 * auto-prepended to Deal.dealName during lead-to-opportunity conversion.
 *
 * Affected records: any Deal whose dealName starts with "Supply - " or "Supply – "
 * (covers hyphen and en-dash variants).
 */
async function main() {
  console.log('Stripping "Supply - " prefix from Deal.dealName...');

  const deals = await prisma.deal.findMany({
    where: {
      OR: [
        { dealName: { startsWith: 'Supply - ' } },
        { dealName: { startsWith: 'Supply – ' } },
        { dealName: { startsWith: 'Supply — ' } },
      ],
    },
    select: { id: true, dealName: true },
  });

  console.log(`Found ${deals.length} deal(s) with the "Supply - " prefix.`);

  if (deals.length === 0) {
    console.log('Nothing to clean up.');
    return;
  }

  let updated = 0;
  for (const deal of deals) {
    let newName = deal.dealName;
    // Strip any of the known prefix variants
    newName = newName.replace(/^Supply\s*[-–—]\s*/, '');
    if (newName !== deal.dealName && newName.trim().length > 0) {
      await prisma.deal.update({
        where: { id: deal.id },
        data: { dealName: newName.trim() },
      });
      console.log(`  Updated ${deal.id}: "${deal.dealName}" -> "${newName.trim()}"`);
      updated++;
    }
  }

  console.log(`Done. Updated ${updated} deal(s).`);
}

main()
  .catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

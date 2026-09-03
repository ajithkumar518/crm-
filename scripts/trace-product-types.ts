import { prisma } from "../lib/prisma";

async function main() {
  const types = await prisma.product.groupBy({
    by: ["productType"],
    where: { deletedAt: null },
    _count: { id: true },
  });
  console.log("Distinct productType values (deletedAt is null):");
  console.table(types.map((t) => ({ value: t.productType, count: t._count.id })));

  const invalid = await prisma.product.findMany({
    where: {
      deletedAt: null,
      NOT: { productType: { in: ["Black Bar", "Bright Bar", "Bright Ground Bar"] } },
    },
    select: {
      id: true,
      productCode: true,
      name: true,
      productType: true,
    },
    orderBy: { productCode: "asc" },
  });

  console.log(`\nProducts with non-matching Product Type: ${invalid.length}`);
  for (const p of invalid) {
    console.log(`  ${p.productCode} | ${p.name} | productType = ${p.productType ?? "(null)"}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

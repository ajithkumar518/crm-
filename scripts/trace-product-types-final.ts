import { prisma } from "../lib/prisma";

async function main() {
  const prods = await prisma.product.findMany({
    where: {
      deletedAt: null,
      OR: [
        { productType: null },
        { productType: { notIn: ["Black Bar", "Bright Bar", "Bright Ground Bar"] } },
      ],
    },
    select: { id: true, productCode: true, name: true, productType: true },
    orderBy: { productCode: "asc" },
  });
  console.log(`Non-conforming products: ${prods.length}`);
  for (const p of prods) {
    console.log(`  ${p.productCode} | ${p.name} | productType = ${p.productType ?? "(null)"}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

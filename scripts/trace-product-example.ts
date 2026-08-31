import { prisma } from "../lib/prisma";

async function main() {
  const prods = await prisma.product.findMany({
    where: { name: { contains: "EXAMPLE" } },
    select: { id: true, productCode: true, name: true, companyId: true, isActive: true, deletedAt: true },
  });
  console.log(JSON.stringify(prods, null, 2));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

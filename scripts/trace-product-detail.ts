import { prisma } from "../lib/prisma";

async function main() {
  const id = process.argv[2] || "6e1d73c3-32f6-442c-9358-2e9bb808b739";
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  });
  console.log(product ? JSON.stringify(product, null, 2) : "Product not found");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

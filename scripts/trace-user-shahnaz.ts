import { prisma } from "../lib/prisma";

async function main() {
  const user = await prisma.user.findFirst({
    where: { name: { contains: "Shahnaz" } },
    select: { id: true, name: true, email: true, role: true, companyId: true },
  });
  console.log(user ? JSON.stringify(user, null, 2) : "User not found");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

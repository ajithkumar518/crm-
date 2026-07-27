import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const users = await prisma.user.findMany({
    include: { company: true },
    take: 5
  });
  for (const u of users) {
    console.log(u.email, "Variant:", u.company?.variant);
  }
}
run();

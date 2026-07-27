import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
async function run() {
  const user = await prisma.user.findUnique({ where: { email: "exec1@sukisoftware.com" } });
  if (user && user.companyId) {
    await prisma.company.update({
      where: { id: user.companyId },
      data: { variant: 1 }
    });
    console.log("Updated exec1's company to variant 1");
  }
}
run();

import { prisma } from "../lib/prisma";

async function main() {
  const configs = [
    { key: "company_name", value: "Shahnaz Bright Steel Industries Private Limited" },
    { key: "company_address", value: "No:1,Plot No.52A,52B,No.102,Mugappair Road\nPadi,Chennai,Tamil Nadu - 600050 , India" },
    { key: "company_phone", value: "9363331766, 7845517678" },
    { key: "company_reg_off", value: "No.327/17A,17B,18,325/2A,2B,3,Kuthiraipallam Village,\nJaganathapuram Post,Ponneri,Tiruvallur Dist,Chennai-600067" },
    { key: "company_pan", value: "ABACS6559E" },
    { key: "company_gstin", value: "33ABACS6559E1ZD" },
    { key: "company_cin", value: "U28999TN2018PTC123999" },
  ];

  for (const c of configs) {
    await prisma.systemConfig.upsert({
      where: { key: c.key },
      create: { key: c.key, value: c.value },
      update: { value: c.value },
    });
  }

  console.log("Company configs set");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

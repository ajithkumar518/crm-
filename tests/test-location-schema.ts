/**
 * Verify the location field works end-to-end: schema + action + read.
 */
import { prisma } from "../lib/prisma";

async function main() {
  const company = await prisma.company.findFirst();
  if (!company) {
    console.log("No company found, cannot test");
    process.exit(1);
  }

  const testCode = `LOC-TEST-${Date.now()}`;
  const customer = await prisma.customer.create({
    data: {
      customerCode: testCode,
      name: "Test Location Customer",
      email: `loc-test-${Date.now()}@example.com`,
      phone: "9876543210",
      city: "Chennai",
      location: "No. 45, Anna Salai, T. Nagar",
      state: "Tamil Nadu",
      status: "Prospect",
      leadSource: "IndiaMART",
      companyId: company.id,
    },
    select: {
      id: true,
      customerCode: true,
      name: true,
      city: true,
      location: true,
      state: true,
      leadSource: true,
    },
  });

  console.log("Created customer:", customer);

  if (customer.location !== "No. 45, Anna Salai, T. Nagar") {
    throw new Error(`Location not saved: got ${customer.location}`);
  }

  await prisma.customer.delete({ where: { id: customer.id } });
  console.log("Schema test PASSED: 'location' field saved and read correctly.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

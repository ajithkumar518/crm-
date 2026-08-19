import { prisma } from "../lib/prisma";

const SUKI_LEAD_SOURCES = [
  "Website",
  "IndiaMART",
  "Justdial",
  "TradeIndia",
  "WhatsApp",
  "Door-to-Door Marketing",
  "Direct Visit",
  "Telephonic Conversation",
  "Email",
];

const SUKI_PRODUCT_CATEGORIES = [
  "Die Steel",
  "Tool Steel",
  "Alloy Steel",
  "Carbon Steel",
  "Special Steel",
];

const DEFAULT_TERMS = `Cutting Charges – Extra
Weighing & Loading Charges – Rs. 350/- per Ton
Delivery Charges – Extra
Testing Charges – Extra
Quotation Validity – Immediate
Taxes – Extra
Rejection Clause – Material will be accepted only in the supplied condition.
Weighment Tolerance – ±5 Kgs per MT.
Note: Clerical errors, if any, are subject to correction.`;

async function seedSukiMasters() {
  // Find or use the first active company. For single-tenant deployments this is the customer company.
  const company = await prisma.company.findFirst({
    where: { planLocked: false },
    orderBy: { createdAt: "asc" },
  });

  if (!company) {
    console.warn("No company found. Please run the superadmin seed first.");
    process.exit(1);
  }

  const companyId = company.id;

  // Lead sources
  for (const name of SUKI_LEAD_SOURCES) {
    await prisma.leadSource.upsert({
      where: { name },
      create: { name, isActive: true, companyId },
      update: { isActive: true },
    });
  }
  console.log(`Seeded ${SUKI_LEAD_SOURCES.length} lead sources.`);

  // Product categories
  for (const name of SUKI_PRODUCT_CATEGORIES) {
    const existing = await prisma.productCategory.findFirst({
      where: { name, companyId },
    });
    if (!existing) {
      await prisma.productCategory.create({
        data: { name, isActive: true, companyId },
      });
    } else if (!existing.isActive) {
      await prisma.productCategory.update({
        where: { id: existing.id },
        data: { isActive: true },
      });
    }
  }
  console.log(`Seeded ${SUKI_PRODUCT_CATEGORIES.length} product categories.`);

  // Default Terms & Conditions
  const existing = await prisma.termsAndConditions.findFirst({
    where: { companyId, name: "SUKI Default Quotation T&C" },
  });
  if (!existing) {
    await prisma.termsAndConditions.create({
      data: {
        name: "SUKI Default Quotation T&C",
        content: DEFAULT_TERMS,
        isDefault: true,
        isActive: true,
        companyId,
      },
    });
  } else if (!existing.isDefault) {
    await prisma.termsAndConditions.update({
      where: { id: existing.id },
      data: { isDefault: true, content: DEFAULT_TERMS },
    });
  }
  console.log("Seeded default Terms & Conditions.");

  console.log("SUKI master seed complete.");
  process.exit(0);
}

seedSukiMasters().catch((error) => {
  console.error("SUKI master seed failed:", error);
  process.exit(1);
});

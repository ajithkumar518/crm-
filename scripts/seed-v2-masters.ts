/**
 * Seed script — Variant 2 master data
 * Run: npx ts-node --project tsconfig.json scripts/seed-v2-masters.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ── 5 Tax Rates ───────────────────────────────────────────────────────────────
const TAX_RATES = [
  { taxName: "GST 5%",   taxPercent: 5  },
  { taxName: "GST 12%",  taxPercent: 12 },
  { taxName: "GST 18%",  taxPercent: 18 },
  { taxName: "GST 28%",  taxPercent: 28 },
  { taxName: "IGST 18%", taxPercent: 18 },
];

// ── 7 V2 Pipeline Stages ──────────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { name: "Qualified",               order: 1,  color: "#3B82F6", probabilityPercent: 20  },
  { name: "Requirement Gathering",   order: 2,  color: "#6366F1", probabilityPercent: 35  },
  { name: "Technical Discussion",    order: 3,  color: "#8B5CF6", probabilityPercent: 50  },
  { name: "Meeting Scheduled",       order: 4,  color: "#A855F7", probabilityPercent: 60  },
  { name: "Demo Conducted",          order: 5,  color: "#EC4899", probabilityPercent: 70  },
  { name: "Won",                     order: 6,  color: "#22C55E", probabilityPercent: 100 },
  { name: "Lost",                    order: 7,  color: "#EF4444", probabilityPercent: 0   },
];

// ── 10 Loss Reasons ───────────────────────────────────────────────────────────
const LOSS_REASONS = [
  "Price Too High",
  "Lost to Competitor",
  "No Budget",
  "Requirement Mismatch",
  "No Response",
  "Project Cancelled",
  "Long Decision Cycle",
  "Technical Gap",
  "Relationship Issue",
  "Other",
];

// ── 9 Lead Sources (8 spec + Email from inbound poller) ───────────────────────
const LEAD_SOURCES = [
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

async function seedTaxRates() {
  console.log("\n📦 Seeding Tax Rates…");
  for (const rate of TAX_RATES) {
    const existing = await prisma.taxMaster.findFirst({
      where: { taxName: rate.taxName, companyId: null },
    });
    if (!existing) {
      await prisma.taxMaster.create({
        data: { ...rate, isActive: true, effectiveFrom: new Date(), companyId: null },
      });
      console.log(`  ✅ ${rate.taxName}`);
    } else {
      console.log(`  ⏭  ${rate.taxName} already exists`);
    }
  }
}

async function seedPipelineStages() {
  console.log("\n🔵 Seeding Pipeline Stages…");
  for (const stage of PIPELINE_STAGES) {
    const existing = await prisma.pipelineStage.findFirst({
      where: { name: stage.name, companyId: null },
    });
    if (!existing) {
      await prisma.pipelineStage.create({
        data: {
          name: stage.name,
          order: stage.order,
          color: stage.color,
          isActive: true,
          companyId: null,
        },
      });
      console.log(`  ✅ ${stage.name} (${stage.probabilityPercent}%)`);
    } else {
      console.log(`  ⏭  ${stage.name} already exists`);
    }
  }
}

async function seedLossReasons() {
  console.log("\n🔴 Seeding Loss Reasons…");
  for (const name of LOSS_REASONS) {
    const existing = await prisma.lossReason.findFirst({
      where: { name, companyId: null },
    });
    if (!existing) {
      await prisma.lossReason.create({
        data: { name, isActive: true, companyId: null },
      });
      console.log(`  ✅ ${name}`);
    } else {
      console.log(`  ⏭  ${name} already exists`);
    }
  }
}

async function seedLeadSources() {
  console.log("\n🟢 Seeding Lead Sources…");
  for (const name of LEAD_SOURCES) {
    const existing = await prisma.leadSource.findFirst({
      where: { name },
    });
    if (!existing) {
      await prisma.leadSource.create({
        data: { name, isActive: true, companyId: null },
      });
      console.log(`  ✅ ${name}`);
    } else {
      console.log(`  ⏭  ${name} already exists`);
    }
  }
}

async function main() {
  console.log("🚀 Starting Variant 2 seed…");
  await seedTaxRates();
  await seedPipelineStages();
  await seedLossReasons();
  await seedLeadSources();
  console.log("\n✅ Seed complete.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

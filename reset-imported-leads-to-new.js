// Reset all leads imported via Excel/CSV back to status "New".
// Identifies imported leads via LeadStatusHistory.notes = "Imported via CSV/Excel".
// Run: node reset-imported-leads-to-new.js
// Load .env manually (dotenv not installed)
const fs = require("fs");
const envPath = require("path").join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf-8").split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^"|"$/g, "");
    }
  });
}
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

(async () => {
  // 1. Find all status-history entries tagged as imported
  const importHistories = await prisma.leadStatusHistory.findMany({
    where: { notes: "Imported via CSV/Excel" },
    select: { leadId: true, toStatus: true },
  });

  const importedLeadIds = [...new Set(importHistories.map((h) => h.leadId))];
  console.log(`Found ${importedLeadIds.length} leads imported via Excel/CSV.`);

  if (importedLeadIds.length === 0) {
    console.log("No imported leads found. Nothing to update.");
    await prisma.$disconnect();
    return;
  }

  // 2. Show current statuses before update
  const before = await prisma.lead.groupBy({
    by: ["status"],
    where: { id: { in: importedLeadIds } },
    _count: { _all: true },
  });
  console.log("\nCurrent status distribution:");
  before.forEach((b) => console.log(`  ${b.status}: ${b._count._all}`));

  // 3. Update all imported leads to status "New"
  const result = await prisma.lead.updateMany({
    where: { id: { in: importedLeadIds }, status: { not: "New" } },
    data: { status: "New" },
  });
  console.log(`\nUpdated ${result.count} lead(s) to status "New".`);

  // 4. Add a status-history entry for each updated lead (audit trail)
  const admin = await prisma.user.findFirst({
    where: { role: "Admin", isActive: true },
    select: { id: true, email: true },
  });

  const leadsToLog = await prisma.lead.findMany({
    where: { id: { in: importedLeadIds }, status: "New" },
    select: { id: true, status: true },
  });

  if (admin) {
    await prisma.leadStatusHistory.createMany({
      data: leadsToLog.map((l) => ({
        leadId: l.id,
        fromStatus: null,
        toStatus: "New",
        changedById: admin.id,
        notes: "Status reset to New (manual bulk update of Excel-imported leads)",
      })),
    });
    console.log(`Added ${leadsToLog.length} status-history entries (attributed to ${admin.email}).`);
  } else {
    console.log("No active admin user found — skipping status-history audit entries.");
  }

  // 5. Verify after update
  const after = await prisma.lead.groupBy({
    by: ["status"],
    where: { id: { in: importedLeadIds } },
    _count: { _all: true },
  });
  console.log("\nStatus distribution after update:");
  after.forEach((a) => console.log(`  ${a.status}: ${a._count._all}`));

  await prisma.$disconnect();
  console.log("\nDone.");
})().catch(async (e) => {
  console.error("Error:", e);
  await prisma.$disconnect();
  process.exit(1);
});

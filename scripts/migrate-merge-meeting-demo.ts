import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // 1. Rename the active Meeting stage to "Meeting & Demo"
  await prisma.pipelineStageMaster.updateMany({
    where: { stageName: "MeetingScheduled" },
    data: { displayName: "Meeting & Demo" },
  });

  // 2. Soft-deactivate the Demo stage
  await prisma.pipelineStageMaster.updateMany({
    where: { stageName: "DemoConducted" },
    data: { isActive: false },
  });

  // 3. Re-sequence display orders so stage adjacency checks still work:
  //    Qualified(1) -> Req.Gathering(2) -> Meeting & Demo(3) -> Proposal(4) -> Negotiation(5) -> Won(6)
  await prisma.pipelineStageMaster.updateMany({
    where: { stageName: "MeetingScheduled" },
    data: { displayOrder: 3 },
  });
  await prisma.pipelineStageMaster.updateMany({
    where: { stageName: "ProposalSent" },
    data: { displayOrder: 4 },
  });
  await prisma.pipelineStageMaster.updateMany({
    where: { stageName: "Negotiation" },
    data: { displayOrder: 5 },
  });
  await prisma.pipelineStageMaster.updateMany({
    where: { stageName: "Won" },
    data: { displayOrder: 6 },
  });

  // 4. Migrate any opportunities currently at DemoConducted to MeetingScheduled
  const migrated = await prisma.deal.updateMany({
    where: { status: "DemoConducted" },
    data: { status: "MeetingScheduled" },
  });

  console.log(`Migration complete. Renamed Meeting -> Meeting & Demo, deactivated Demo, reordered stages, and migrated ${migrated.count} opportunity(s) from DemoConducted to MeetingScheduled.`);
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

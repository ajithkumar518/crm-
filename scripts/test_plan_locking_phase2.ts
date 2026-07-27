import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import fs from "fs";
import path from "path";

// Load .env manually if needed
const envPath = path.resolve(__dirname, "../.env");
if (fs.existsSync(envPath)) {
  const envConfig = fs.readFileSync(envPath, "utf-8");
  envConfig.split("\n").forEach((line) => {
    const [key, ...val] = line.split("=");
    if (key && val.length > 0 && !process.env[key.trim()]) {
      process.env[key.trim()] = val.join("=").trim().replace(/^["']|["']$/g, "");
    }
  });
}

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";

async function runTest() {
  console.log("=== STARTING PHASE 2 SERVER-SIDE ENFORCEMENT VERIFICATION ===\n");

  // 1. Test Locked Company (Demo Variant 1 Company)
  console.log("--- PART 1: TESTING LOCKED COMPANY (planLocked = true) ---");
  const lockedUser = await prisma.user.findFirst({
    where: { email: "variant1@sukisoftware.com" },
    include: { company: true },
  });

  if (!lockedUser || !lockedUser.company || !lockedUser.companyId) {
    throw new Error("variant1@sukisoftware.com or its company not found!");
  }

  console.log(`User: ${lockedUser.name} (${lockedUser.email}), Role: ${lockedUser.role}`);
  console.log(`Company: ${lockedUser.company.name} (id: ${lockedUser.company.id})`);
  console.log(`[Before State] planLocked: ${lockedUser.company.planLocked}, variant: ${lockedUser.company.variant}, enabledModules: ${lockedUser.company.enabledModules}`);

  if (!lockedUser.company.planLocked) {
    throw new Error("Expected Demo Variant 1 Company to have planLocked = true!");
  }

  const lockedBeforeVariant = lockedUser.company.variant;
  const lockedBeforeModules = lockedUser.company.enabledModules;

  const lockedToken = jwt.sign(
    {
      id: lockedUser.id,
      email: lockedUser.email,
      role: lockedUser.role,
      companyId: lockedUser.companyId,
      variant: lockedBeforeVariant,
      enabledModules: lockedBeforeModules,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    },
    JWT_SECRET
  );

  console.log("\nAttempting to switch Locked Company to Variant 4 via updateCompanyVariantAction...");
  const resVarLocked = await fetch("http://localhost:3000/api/test-phase2-lock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${lockedToken}`,
    },
    body: JSON.stringify({ action: "variant", val: 4 }),
  });
  const bodyVarLocked = await resVarLocked.json();
  console.log("API Response:", bodyVarLocked);

  console.log("Attempting to enable modules ['forecast', 'targets'] via updateCompanyModulesAction...");
  const resModLocked = await fetch("http://localhost:3000/api/test-phase2-lock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${lockedToken}`,
    },
    body: JSON.stringify({ action: "modules", val: ["forecast", "targets"] }),
  });
  const bodyModLocked = await resModLocked.json();
  console.log("API Response:", bodyModLocked);

  // Check actual DB state after attempts
  const lockedAfterCompany = await prisma.company.findUnique({
    where: { id: lockedUser.companyId },
  });
  console.log(`\n[After State] planLocked: ${lockedAfterCompany?.planLocked}, variant: ${lockedAfterCompany?.variant}, enabledModules: ${lockedAfterCompany?.enabledModules}`);

  if (lockedAfterCompany?.variant !== lockedBeforeVariant || lockedAfterCompany?.enabledModules !== lockedBeforeModules) {
    throw new Error("FAIL: Database state WAS mutated for a locked company!");
  }
  if (bodyVarLocked.success !== false || bodyModLocked.success !== false) {
    throw new Error("FAIL: Server action did not return success: false for locked company!");
  }
  console.log("✓ SUCCESS: Server actions rejected mutations and DB state remained identical for Locked Company!\n");

  // 2. Test Unlocked Company (Suki Software Solutions Pvt. Ltd.)
  console.log("--- PART 2: TESTING UNLOCKED COMPANY (planLocked = false) ---");
  const unlockedUser = await prisma.user.findFirst({
    where: { email: "admin@sukisoftware.com" },
    include: { company: true },
  });

  if (!unlockedUser || !unlockedUser.company || !unlockedUser.companyId) {
    throw new Error("admin@sukisoftware.com or its company not found!");
  }

  console.log(`User: ${unlockedUser.name} (${unlockedUser.email}), Role: ${unlockedUser.role}`);
  console.log(`Company: ${unlockedUser.company.name} (id: ${unlockedUser.company.id})`);
  console.log(`[Before State] planLocked: ${unlockedUser.company.planLocked}, variant: ${unlockedUser.company.variant}, enabledModules: ${unlockedUser.company.enabledModules}`);

  if (unlockedUser.company.planLocked) {
    throw new Error("Expected Suki Software Solutions Pvt. Ltd. to have planLocked = false!");
  }

  const unlockedBeforeVariant = unlockedUser.company.variant;
  const unlockedBeforeModules = unlockedUser.company.enabledModules;

  const unlockedToken = jwt.sign(
    {
      id: unlockedUser.id,
      email: unlockedUser.email,
      role: unlockedUser.role,
      companyId: unlockedUser.companyId,
      variant: unlockedBeforeVariant,
      enabledModules: unlockedBeforeModules,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    },
    JWT_SECRET
  );

  console.log("\nAttempting to switch Unlocked Company to Variant 3 via updateCompanyVariantAction...");
  const resVarUnlocked = await fetch("http://localhost:3000/api/test-phase2-lock", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${unlockedToken}`,
    },
    body: JSON.stringify({ action: "variant", val: 3 }),
  });
  const bodyVarUnlocked = await resVarUnlocked.json();
  console.log("API Response:", bodyVarUnlocked);

  const unlockedAfterCompany = await prisma.company.findUnique({
    where: { id: unlockedUser.companyId },
  });
  console.log(`\n[After State] planLocked: ${unlockedAfterCompany?.planLocked}, variant: ${unlockedAfterCompany?.variant}, enabledModules: ${unlockedAfterCompany?.enabledModules}`);

  if (unlockedAfterCompany?.variant !== 3) {
    throw new Error(`FAIL: Expected variant 3 after update on unlocked company, got ${unlockedAfterCompany?.variant}`);
  }
  if (bodyVarUnlocked.success !== true) {
    throw new Error("FAIL: Server action did not return success: true for unlocked company!");
  }
  console.log("✓ SUCCESS: Server action succeeded and updated DB state for Unlocked Company!\n");

  // Revert unlocked company back to original state
  await prisma.company.update({
    where: { id: unlockedUser.companyId },
    data: { variant: unlockedBeforeVariant, enabledModules: unlockedBeforeModules },
  });
  console.log("--- CLEANUP: Reverted Unlocked Company back to original state ---");

  await prisma.$disconnect();
}

runTest().catch((e) => {
  console.error("TEST FAILED:", e);
  prisma.$disconnect();
  process.exit(1);
});

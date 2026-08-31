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

function createTokenForUser(user: any) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
      variant: user.company?.variant || 1,
      enabledModules: user.company?.enabledModules || "[]",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400,
    },
    JWT_SECRET
  );
}

async function callTestEndpoint(action: "variant" | "modules", val: any, token: string) {
  const res = await fetch("http://localhost:3000/api/test-plan-lock-e2e", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `token=${token}`,
    },
    body: JSON.stringify({ action, val }),
  });
  return await res.json();
}

async function runFullVerification() {
  console.log("================================================================================");
  console.log("       FULL E2E PLAN LOCKING VERIFICATION (POSITIVE & REJECTION SUITE)");
  console.log("================================================================================\n");

  // ----------------------------------------------------------------------------
  // 1. POSITIVE-CASE TEST: UNLOCKED SUKI SOFTWARE TENANT
  // ----------------------------------------------------------------------------
  console.log("--- TEST 1: POSITIVE CASE (UNLOCKED TENANT: Suki Software Solutions Pvt. Ltd.) ---");
  const unlockedUser = await prisma.user.findFirst({
    where: { email: "admin@sukisoftware.com" },
    include: { company: true },
  });

  if (!unlockedUser || !unlockedUser.company) {
    throw new Error("admin@sukisoftware.com or its company not found!");
  }

  if (unlockedUser.company.planLocked !== false) {
    throw new Error("Expected Suki Software Solutions Pvt. Ltd. to have planLocked = false!");
  }

  const tokenUnlocked = createTokenForUser(unlockedUser);
  const origVariant = unlockedUser.company.variant;
  const origModules = unlockedUser.company.enabledModules;

  console.log(`User: ${unlockedUser.name} (${unlockedUser.email}), Role: ${unlockedUser.role}`);
  console.log(`Company: ${unlockedUser.company.name} [planLocked = ${unlockedUser.company.planLocked}]`);
  console.log(`[Before DB State] variant: ${origVariant}, enabledModules: ${origModules}`);

  console.log("\n[Action 1A] Executing updateCompanyVariantAction(3) via HTTP API...");
  const resVarSuccess = await callTestEndpoint("variant", 3, tokenUnlocked);
  console.log(" -> API Response:", resVarSuccess);

  const afterVarCompany = await prisma.company.findUnique({ where: { id: unlockedUser.companyId! } });
  console.log(`[After Action 1A DB State] variant: ${afterVarCompany?.variant}, enabledModules: ${afterVarCompany?.enabledModules}`);
  if (afterVarCompany?.variant !== 3 || resVarSuccess.success !== true) {
    throw new Error("FAIL: Positive case updateCompanyVariantAction did not update DB!");
  }

  console.log("\n[Action 1B] Executing updateCompanyModulesAction(['forecast', 'targets', 'deals']) via HTTP API...");
  const resModSuccess = await callTestEndpoint("modules", ["forecast", "targets", "deals"], tokenUnlocked);
  console.log(" -> API Response:", resModSuccess);

  const afterModCompany = await prisma.company.findUnique({ where: { id: unlockedUser.companyId! } });
  console.log(`[After Action 1B DB State] variant: ${afterModCompany?.variant}, enabledModules: ${afterModCompany?.enabledModules}`);
  if (resModSuccess.success !== true || !afterModCompany?.enabledModules.includes("forecast")) {
    throw new Error("FAIL: Positive case updateCompanyModulesAction did not update DB!");
  }

  // Cleanup unlocked tenant back to original state
  await prisma.company.update({
    where: { id: unlockedUser.companyId! },
    data: { variant: origVariant, enabledModules: origModules },
  });
  console.log("✓ SUCCESS: Unlocked tenant successfully mutated DB in positive case (and reverted cleanly).\n");

  // ----------------------------------------------------------------------------
  // 2. REJECTION-CASE SUITE: VARIANT 1, VARIANT 2, AND VARIANT 3 DEMO TENANTS
  // ----------------------------------------------------------------------------
  const demoEmails = [
    { label: "Variant 1 Demo Tenant", email: "variant1@sukisoftware.com", targetVariant: 4, targetModules: ["rfq", "documents"] },
    { label: "Variant 2 Demo Tenant", email: "variant2@sukisoftware.com", targetVariant: 3, targetModules: ["forecast", "key_accounts"] },
    { label: "Variant 3 Demo Tenant", email: "variant3@sukisoftware.com", targetVariant: 4, targetModules: ["deals", "territories"] },
  ];

  for (const demo of demoEmails) {
    console.log(`--------------------------------------------------------------------------------`);
    console.log(`--- TEST 2 & 3: REJECTION CASE (${demo.label}: ${demo.email}) ---`);
    console.log(`--------------------------------------------------------------------------------`);
    const lockedUser = await prisma.user.findFirst({
      where: { email: demo.email },
      include: { company: true },
    });

    if (!lockedUser || !lockedUser.company) {
      throw new Error(`User ${demo.email} or its company not found!`);
    }

    if (lockedUser.company.planLocked !== true) {
      throw new Error(`Expected ${lockedUser.company.name} to have planLocked = true!`);
    }

    const tokenLocked = createTokenForUser(lockedUser);
    const beforeVar = lockedUser.company.variant;
    const beforeMod = lockedUser.company.enabledModules;

    console.log(`User: ${lockedUser.name} (${lockedUser.email}), Role: ${lockedUser.role}`);
    console.log(`Company: ${lockedUser.company.name} [planLocked = ${lockedUser.company.planLocked}]`);
    console.log(`[Before DB State] variant: ${beforeVar}, enabledModules: ${beforeMod}`);

    console.log(`\n[Action: Variant Upgrade Rejection] Attempting updateCompanyVariantAction(${demo.targetVariant})...`);
    const resVarLocked = await callTestEndpoint("variant", demo.targetVariant, tokenLocked);
    console.log(" -> API Response:", resVarLocked);

    if (resVarLocked.success !== false || !resVarLocked.message.includes("managed by Suki Software")) {
      throw new Error(`FAIL: updateCompanyVariantAction did not reject for ${demo.email}!`);
    }

    console.log(`\n[Action: Module Upgrade Rejection] Attempting updateCompanyModulesAction(${JSON.stringify(demo.targetModules)})...`);
    const resModLocked = await callTestEndpoint("modules", demo.targetModules, tokenLocked);
    console.log(" -> API Response:", resModLocked);

    if (resModLocked.success !== false || !resModLocked.message.includes("managed by Suki Software")) {
      throw new Error(`FAIL: updateCompanyModulesAction did not reject for ${demo.email}!`);
    }

    const afterCompany = await prisma.company.findUnique({ where: { id: lockedUser.companyId! } });
    console.log(`\n[After DB State] variant: ${afterCompany?.variant}, enabledModules: ${afterCompany?.enabledModules}`);

    if (afterCompany?.variant !== beforeVar || afterCompany?.enabledModules !== beforeMod) {
      throw new Error(`FAIL: Database state WAS mutated for locked tenant ${demo.email}!`);
    }
    console.log(`✓ SUCCESS: Both variant and module actions rejected with zero DB mutation for ${demo.label}!\n`);
  }

  console.log("================================================================================");
  console.log("       ALL POSITIVE AND REJECTION TEST SUITES PASSED 100%!");
  console.log("================================================================================");
  await prisma.$disconnect();
}

runFullVerification().catch((err) => {
  console.error("VERIFICATION SUITE FAILED:", err);
  prisma.$disconnect();
  process.exit(1);
});

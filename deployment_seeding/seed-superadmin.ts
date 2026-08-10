/**
 * Deploy Seed Script — configurable initial admin / superadmin user.
 *
 * Creates ONLY one user attached to a company.
 * Does NOT seed any other data.
 *
 * Set these in .env before running:
 *   SUPERADMIN_PASSWORD              (required)
 *   SUPERADMIN_EMAIL                 default: superadmin@sukisoftware.com
 *   SUPERADMIN_NAME                  default: Super Admin
 *   SUPERADMIN_ROLE                  default: SuperAdmin
 *   SUPERADMIN_COMPANY_NAME          default: Suki Software
 *   SUPERADMIN_COMPANY_VARIANT       default: 2
 *   SUPERADMIN_COMPANY_DOMAIN        default: (empty)
 *   SUPERADMIN_PLAN_LOCKED           default: false
 *   SUPERADMIN_SERVICE_CRM_ENABLED   default: false
 *
 * Idempotent: re-running updates the existing records in place.
 *
 * Run: npx tsx scripts/seed-superadmin.ts
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function getEnv(name: string, fallback?: string): string | undefined {
  const value = process.env[name];
  return value === undefined ? fallback : value;
}

function isTrue(value: string | undefined): boolean {
  return value === "true" || value === "1" || value === "yes";
}

// ─── Configuration from .env ───────────────────────────────────────────────────

const ADMIN_USER = {
  email: getEnv("SUPERADMIN_EMAIL", "superadmin@sukisoftware.com")!,
  name: getEnv("SUPERADMIN_NAME", "Super Admin")!,
  role: getEnv("SUPERADMIN_ROLE", "SuperAdmin")!,
  password: process.env.SUPERADMIN_PASSWORD,
};

const COMPANY = {
  name: getEnv("SUPERADMIN_COMPANY_NAME", "Suki Software")!,
  variant: Number(getEnv("SUPERADMIN_COMPANY_VARIANT", "2")) || 2,
  domain: getEnv("SUPERADMIN_COMPANY_DOMAIN")?.trim() || undefined,
  planLocked: isTrue(process.env.SUPERADMIN_PLAN_LOCKED),
  serviceCrmEnabled: isTrue(process.env.SUPERADMIN_SERVICE_CRM_ENABLED),
};

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!ADMIN_USER.password) {
    throw new Error("SUPERADMIN_PASSWORD environment variable is required.");
  }

  console.log(`Seeding ${ADMIN_USER.role} (variant ${COMPANY.variant})...\n`);

  // 1. Find or create the company
  let company = await prisma.company.findFirst({
    where: { name: COMPANY.name },
  });

  const companyCreateData = {
    name: COMPANY.name,
    variant: COMPANY.variant,
    planLocked: COMPANY.planLocked,
    serviceCrmEnabled: COMPANY.serviceCrmEnabled,
    domain: COMPANY.domain,
  };

  const companyUpdateData = {
    variant: COMPANY.variant,
    planLocked: COMPANY.planLocked,
    serviceCrmEnabled: COMPANY.serviceCrmEnabled,
    domain: COMPANY.domain,
  };

  if (!company) {
    company = await prisma.company.create({ data: companyCreateData });
    console.log(
      `Created company: ${company.name} (variant ${company.variant})`,
    );
  } else {
    const needsUpdate =
      company.variant !== COMPANY.variant ||
      company.planLocked !== COMPANY.planLocked ||
      company.serviceCrmEnabled !== COMPANY.serviceCrmEnabled ||
      (COMPANY.domain && company.domain !== COMPANY.domain);

    if (needsUpdate) {
      company = await prisma.company.update({
        where: { id: company.id },
        data: companyUpdateData,
      });
      console.log(
        `Updated company: ${company.name} (variant ${company.variant}, planLocked ${company.planLocked})`,
      );
    } else {
      console.log(
        `Company already exists: ${company.name} (variant ${company.variant})`,
      );
    }
  }

  // 2. Find or create the admin user
  const passwordHash = await bcrypt.hash(ADMIN_USER.password, 10);
  const userData = {
    name: ADMIN_USER.name,
    role: ADMIN_USER.role,
    passwordHash,
    isActive: true,
    isFirstLogin: false,
    variantLocked: true,
    passwordSetAt: new Date(),
    company: { connect: { id: company.id } },
  };

  let user = await prisma.user.findUnique({
    where: { email: ADMIN_USER.email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: ADMIN_USER.email,
        ...userData,
      },
    });
    console.log(`Created ${user.role}: ${user.email}`);
  } else {
    user = await prisma.user.update({
      where: { email: ADMIN_USER.email },
      data: userData,
    });
    console.log(`Updated ${user.role}: ${user.email}`);
  }

  console.log("\nDeploy seed complete:");
  console.log(`  Email:    ${user.email}`);
  console.log(`  Role:     ${user.role}`);
  console.log(`  Company:  ${company.name} (variant ${company.variant})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

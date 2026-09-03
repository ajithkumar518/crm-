import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { enforceModuleGuard, hasModule } from "@/lib/moduleGuard";
import { MODULE_KEYS, ModuleKey } from "@/lib/config/moduleVariantMap";

// Maps config key prefixes or exact keys to required module permissions (Variant tiers)
export const CONFIG_KEY_SECURITY_MAP: Array<{ prefix?: string; exact?: string; moduleKey: ModuleKey }> = [
  { prefix: "notif_", moduleKey: MODULE_KEYS.MANAGER_DASHBOARD }, // V2+
  { prefix: "approval_matrix_", moduleKey: MODULE_KEYS.APPROVAL_CENTER }, // V3+
  { exact: "sampleConfig", moduleKey: MODULE_KEYS.SAMPLE_MANAGEMENT }, // V3+
  { prefix: "sample_config_", moduleKey: MODULE_KEYS.SAMPLE_MANAGEMENT }, // V3+
  { exact: "documentTypes", moduleKey: MODULE_KEYS.DOCUMENTS }, // V3+
  { exact: "customFields", moduleKey: MODULE_KEYS.DEALS }, // V3+
];

export function getRequiredModuleForKey(key: string): ModuleKey | null {
  for (const rule of CONFIG_KEY_SECURITY_MAP) {
    if (rule.exact && rule.exact === key) return rule.moduleKey;
    if (rule.prefix && key.startsWith(rule.prefix)) return rule.moduleKey;
  }
  return null;
}

/**
 * Compliance-sensitive config keys whose values are validated before saving.
 * These keys affect customer-facing tax documents (quotations, proforma invoices).
 * A placeholder/fabricated value in one of these keys could create incorrect tax
 * invoices with real compliance consequences.
 */
const COMPLIANCE_SENSITIVE_KEYS = ["company_gstin"];

/**
 * Validate a compliance-sensitive config value before it is saved.
 * Returns an error message string if the value is rejected, or null if it is valid.
 *
 * For company_gstin:
 *   - Must be a valid 15-character Indian GSTIN format
 *   - Must NOT contain placeholder PAN patterns (e.g. "AAAAA0000A" — all repeated
 *     letters in the PAN segment are obviously not a real PAN)
 *   - This prevents fabricated/sample GSTINs from being saved to the live database
 */
function validateComplianceValue(key: string, value: string): string | null {
  if (!COMPLIANCE_SENSITIVE_KEYS.includes(key)) return null;

  if (key === "company_gstin") {
    const trimmed = value.trim().toUpperCase();

    // Format check: 2-digit state code + 10-char PAN + entity + Z + check digit
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(trimmed)) {
      return `company_gstin "${trimmed}" is not a valid 15-character Indian GSTIN. Expected format: 2-digit state code + 10-char PAN + entity code + Z + check digit (e.g. 33AABCU1234A1Z5).`;
    }

    // Placeholder detection: check for obviously fake PAN segments
    // A real PAN has 5 letters (first 5 chars of the PAN portion) that are NOT all the same.
    // Position 3-7 of the GSTIN are the first 5 letters of the PAN.
    const panLetters = trimmed.substring(2, 7); // chars 3-7 (0-indexed 2-6)
    const allSameLetter = panLetters.split("").every((c) => c === panLetters[0]);
    if (allSameLetter) {
      return `company_gstin "${trimmed}" appears to be a placeholder/fabricated value — the PAN segment "${panLetters}" consists of the same repeated letter, which is not a real PAN. Refusing to save. Provide the actual company GSTIN.`;
    }

    // Additional placeholder check: "0000" in the numeric portion of PAN (positions 7-10)
    const panDigits = trimmed.substring(7, 11);
    if (panDigits === "0000") {
      return `company_gstin "${trimmed}" appears to be a placeholder/fabricated value — the PAN numeric segment is "0000". Refusing to save. Provide the actual company GSTIN.`;
    }
  }

  return null;
}

// GET all system configs (admin only, filtered by tenant variant permissions)
export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SuperAdmin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const configs = await prisma.systemConfig.findMany();
  
  // Filter out config keys for modules the user's tenant does not have access to
  const filteredConfigs = configs.filter((c) => {
    const requiredModule = getRequiredModuleForKey(c.key);
    if (!requiredModule) return true;
    return hasModule(user, requiredModule);
  });

  return NextResponse.json({ success: true, data: filteredConfigs });
}

// PUT - bulk update system configs (enforcing module guards per key)
export async function PUT(request: NextRequest) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (!["Admin", "SuperAdmin", "SalesManager"].includes(user.role ?? "")) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
  }

  const body = await request.json();
  const { updates } = body as { updates: { key: string; value: string }[] };

  if (!Array.isArray(updates)) {
    return NextResponse.json({ success: false, message: "updates must be an array of {key, value}" }, { status: 400 });
  }

  // Enforce module guard for each updated config key
  for (const { key } of updates) {
    const requiredModule = getRequiredModuleForKey(key);
    if (requiredModule) {
      const guard = enforceModuleGuard(user, requiredModule, `PUT /api/system-configs (${key})`);
      if (guard) return guard;
    }
  }

  // Validate compliance-sensitive config values (e.g. company_gstin) before saving.
  // This prevents placeholder/fabricated values from entering the live database.
  for (const { key, value } of updates) {
    const validationError = validateComplianceValue(key, value);
    if (validationError) {
      return NextResponse.json(
        { success: false, message: validationError },
        { status: 400 }
      );
    }
  }

  const ops = updates.map(({ key, value }) =>
    prisma.systemConfig.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    })
  );

  await prisma.$transaction(ops);

  return NextResponse.json({ success: true, message: `${updates.length} config(s) saved` });
}

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

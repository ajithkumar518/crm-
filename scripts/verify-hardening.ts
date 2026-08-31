/**
 * Automated Regression Verification Harness for V3 CRM Multi-Tenant Security Hardening
 *
 * This script tests the real enforceModuleGuard, hasModule, and CONFIG_KEY_SECURITY_MAP
 * functions against simulated V1 Starter, V2 Growth, V3 Pro, and V4 Enterprise tenant payloads.
 *
 * Usage: npx tsx scripts/verify-hardening.ts
 */

import { enforceModuleGuard, hasModule } from "@/lib/moduleGuard";
import { MODULE_KEYS, ModuleKey } from "@/lib/config/moduleVariantMap";
import { getRequiredModuleForKey } from "@/app/api/system-configs/route";

async function runSecurityVerification() {
  console.log("🚀 Starting V3 CRM Multi-Tenant Hardening Regression Suite...\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Setup Mock Tenants across all 4 Variant Tiers
  const v1Tenant = { id: "user-v1", email: "starter@tenant.com", role: "Admin", variant: 1, iat: 0, exp: 0 };
  const v2Tenant = { id: "user-v2", email: "growth@tenant.com", role: "Admin", variant: 2, iat: 0, exp: 0 };
  const v3Tenant = { id: "user-v3", email: "pro@tenant.com", role: "Admin", variant: 3, iat: 0, exp: 0 };
  const v4Tenant = { id: "user-v4", email: "enterprise@tenant.com", role: "Admin", variant: 4, iat: 0, exp: 0 };

  console.log("--- TEST SECTION 1: API Config Security Map (system-configs) ---");
  const testKeys = [
    { key: "notif_email_enabled", expectedModule: MODULE_KEYS.MANAGER_DASHBOARD, minVariant: 2 },
    { key: "approval_matrix_discount", expectedModule: MODULE_KEYS.APPROVAL_CENTER, minVariant: 3 },
    { key: "sampleConfig", expectedModule: MODULE_KEYS.SAMPLE_MANAGEMENT, minVariant: 3 },
    { key: "documentTypes", expectedModule: MODULE_KEYS.DOCUMENTS, minVariant: 3 },
    { key: "customFields", expectedModule: MODULE_KEYS.DEALS, minVariant: 3 },
  ];

  for (const { key, expectedModule, minVariant } of testKeys) {
    const mappedModule = getRequiredModuleForKey(key);
    assert(mappedModule === expectedModule, `Key '${key}' maps to module '${expectedModule}'`);

    // Check V1 Tenant Access (should be blocked for all V2/V3 keys)
    const v1Guard = enforceModuleGuard(v1Tenant, mappedModule!, `PUT /api/system-configs (${key})`);
    assert(v1Guard !== null && v1Guard.status === 403, `[V1 Starter] Blocked (403) from mutating '${key}'`);

    // Check V2 Tenant Access (Boundary test for minVariant: 3 keys)
    if (minVariant === 3) {
      const v2Guard = enforceModuleGuard(v2Tenant, mappedModule!, `PUT /api/system-configs (${key})`);
      assert(v2Guard !== null && v2Guard.status === 403, `[V2 Growth Boundary] Blocked (403) from mutating '${key}' (requires V3+)`);
    } else if (minVariant <= 2) {
      const v2Guard = enforceModuleGuard(v2Tenant, mappedModule!, `PUT /api/system-configs (${key})`);
      assert(v2Guard === null, `[V2 Growth] Allowed access to '${key}'`);
    }

    // Check V3 Tenant Access
    if (minVariant <= 3) {
      const v3Guard = enforceModuleGuard(v3Tenant, mappedModule!, `PUT /api/system-configs (${key})`);
      assert(v3Guard === null, `[V3 Pro] Allowed access to '${key}'`);
    }

    // Check V4 Tenant Access (Superset sanity check)
    const v4Guard = enforceModuleGuard(v4Tenant, mappedModule!, `PUT /api/system-configs (${key})`);
    assert(v4Guard === null, `[V4 Enterprise Superset] Allowed access to '${key}'`);
  }

  console.log("\n--- TEST SECTION 2: Dedicated Settings API Routes ---");
  // Pipeline Stages (Requires V2+)
  const pipelineV1Guard = enforceModuleGuard(v1Tenant, MODULE_KEYS.MANAGER_DASHBOARD, "GET /api/settings/pipeline-stages");
  const pipelineV2Guard = enforceModuleGuard(v2Tenant, MODULE_KEYS.MANAGER_DASHBOARD, "GET /api/settings/pipeline-stages");
  const pipelineV4Guard = enforceModuleGuard(v4Tenant, MODULE_KEYS.MANAGER_DASHBOARD, "GET /api/settings/pipeline-stages");
  assert(pipelineV1Guard !== null && pipelineV1Guard.status === 403, "[V1 Starter] Blocked (403) from /api/settings/pipeline-stages");
  assert(pipelineV2Guard === null, "[V2 Growth] Allowed access to /api/settings/pipeline-stages");
  assert(pipelineV4Guard === null, "[V4 Enterprise Superset] Allowed access to /api/settings/pipeline-stages");

  // Loss Reasons (Requires V3+ -> Boundary test V2 blocked)
  const lossV1Guard = enforceModuleGuard(v1Tenant, MODULE_KEYS.DEALS, "GET /api/loss-reasons");
  const lossV2Guard = enforceModuleGuard(v2Tenant, MODULE_KEYS.DEALS, "GET /api/loss-reasons");
  const lossV3Guard = enforceModuleGuard(v3Tenant, MODULE_KEYS.DEALS, "GET /api/loss-reasons");
  const lossV4Guard = enforceModuleGuard(v4Tenant, MODULE_KEYS.DEALS, "GET /api/loss-reasons");
  assert(lossV1Guard !== null && lossV1Guard.status === 403, "[V1 Starter] Blocked (403) from /api/loss-reasons");
  assert(lossV2Guard !== null && lossV2Guard.status === 403, "[V2 Growth Boundary] Blocked (403) from /api/loss-reasons (requires V3+)");
  assert(lossV3Guard === null, "[V3 Pro] Allowed access to /api/loss-reasons");
  assert(lossV4Guard === null, "[V4 Enterprise Superset] Allowed access to /api/loss-reasons");

  // WhatsApp Templates (Requires V2+)
  const waV1Guard = enforceModuleGuard(v1Tenant, MODULE_KEYS.MANAGER_DASHBOARD, "POST /api/whatsapp-templates");
  const waV2Guard = enforceModuleGuard(v2Tenant, MODULE_KEYS.MANAGER_DASHBOARD, "POST /api/whatsapp-templates");
  const waV4Guard = enforceModuleGuard(v4Tenant, MODULE_KEYS.MANAGER_DASHBOARD, "POST /api/whatsapp-templates");
  assert(waV1Guard !== null && waV1Guard.status === 403, "[V1 Starter] Blocked (403) from /api/whatsapp-templates");
  assert(waV2Guard === null, "[V2 Growth] Allowed access to /api/whatsapp-templates");
  assert(waV4Guard === null, "[V4 Enterprise Superset] Allowed access to /api/whatsapp-templates");

  console.log("\n--- TEST SECTION 3: Quotation Stepper Runtime Filtering ---");
  function getFilteredSteps(tenant: any) {
    const hasMod = (key: ModuleKey) => hasModule(tenant, key);
    return ["Draft", "Approved", "Quotation Sent", "UnderReview", "Accepted", "Deal/PO"].filter(key => {
      if (key === "UnderReview" && !hasMod(MODULE_KEYS.NEGOTIATION)) return false;
      if (key === "Deal/PO" && !(hasMod(MODULE_KEYS.DEALS) || hasMod(MODULE_KEYS.PURCHASE_ORDERS))) return false;
      return true;
    });
  }

  const stepsV1 = getFilteredSteps(v1Tenant);
  assert(
    JSON.stringify(stepsV1) === JSON.stringify(["Draft", "Approved", "Quotation Sent", "Accepted"]),
    `[V1 Starter] Stepper steps: ${JSON.stringify(stepsV1)} (Negotiation & Deal/PO absent)`
  );

  // V2 Boundary Case: Negotiation (V3) and Deal/PO (V3/V4) should still be absent on V2
  const stepsV2 = getFilteredSteps(v2Tenant);
  assert(
    JSON.stringify(stepsV2) === JSON.stringify(["Draft", "Approved", "Quotation Sent", "Accepted"]),
    `[V2 Growth Boundary] Stepper steps: ${JSON.stringify(stepsV2)} (Negotiation & Deal/PO still absent on V2)`
  );

  const stepsV3 = getFilteredSteps(v3Tenant);
  assert(
    JSON.stringify(stepsV3) === JSON.stringify(["Draft", "Approved", "Quotation Sent", "UnderReview", "Accepted", "Deal/PO"]),
    `[V3 Pro] Stepper steps: ${JSON.stringify(stepsV3)} (All stages present)`
  );

  // V4 Superset Sanity Check
  const stepsV4 = getFilteredSteps(v4Tenant);
  assert(
    JSON.stringify(stepsV4) === JSON.stringify(["Draft", "Approved", "Quotation Sent", "UnderReview", "Accepted", "Deal/PO"]),
    `[V4 Enterprise Superset] Stepper steps: ${JSON.stringify(stepsV4)} (All stages present)`
  );

  console.log(`\n==================================================`);
  console.log(`Regression Suite Summary: ${passed} PASSED, ${failed} FAILED`);
  console.log(`==================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSecurityVerification();

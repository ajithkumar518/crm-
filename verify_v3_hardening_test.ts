import { enforceModuleGuard } from "./lib/moduleGuard";
import { MODULE_KEYS } from "./lib/config/moduleVariantMap";

const v1User = { id: "user-v1", companyId: "comp-1", role: "SalesManager", variant: 1 };
const v2User = { id: "user-v2", companyId: "comp-2", role: "SalesManager", variant: 2 };
const v3User = { id: "user-v3", companyId: "comp-3", role: "SalesManager", variant: 3 };

const v3Modules = [
  { key: MODULE_KEYS.SAMPLE_MANAGEMENT, name: "Sample Management", endpoint: "GET /api/samples" },
  { key: MODULE_KEYS.NEGOTIATION, name: "Negotiation", endpoint: "PUT /api/negotiations/[id]" },
  { key: MODULE_KEYS.DOCUMENTS, name: "Documents", endpoint: "DELETE /api/documents/[id]" },
  { key: MODULE_KEYS.APPROVAL_CENTER, name: "Approval Center", endpoint: "PATCH /api/approvals/[id]" },
  { key: MODULE_KEYS.DEALS, name: "Deals", endpoint: "POST /api/deals" },
];

console.log("=== V3 MODULE GUARD VERIFICATION TABLE ===");
console.log("Module Name          | Endpoint                 | V1 Status | V2 Status | V3 Status");
console.log("-----------------------------------------------------------------------------------");

for (const mod of v3Modules) {
  const resV1 = enforceModuleGuard(v1User as any, mod.key, mod.endpoint);
  const resV2 = enforceModuleGuard(v2User as any, mod.key, mod.endpoint);
  const resV3 = enforceModuleGuard(v3User as any, mod.key, mod.endpoint);

  const statusV1 = resV1 ? `${resV1.status} (Blocked)` : "200 (Allowed)";
  const statusV2 = resV2 ? `${resV2.status} (Blocked)` : "200 (Allowed)";
  const statusV3 = resV3 ? `${resV3.status} (Blocked)` : "200 (Allowed)";

  console.log(
    `${mod.name.padEnd(20)} | ${mod.endpoint.padEnd(24)} | ${statusV1.padEnd(9)} | ${statusV2.padEnd(9)} | ${statusV3}`
  );
}

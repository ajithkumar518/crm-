import { enforceModuleGuard } from "./lib/moduleGuard";
import { MODULE_KEYS } from "./lib/config/moduleVariantMap";

const mockV1User = {
  id: "user-1",
  companyId: "comp-1",
  role: "SalesManager",
  variant: 1, // V1 tenant
};

const result = enforceModuleGuard(mockV1User as any, MODULE_KEYS.CUSTOMER_VISITS, "GET /api/visits");

if (result) {
  console.log("Status:", result.status);
  // Next 15+ responses use a Symbol for body, but we can do:
  console.log("Body:", result.statusText || "Forbidden");
  result.json().then(b => console.log(b)).catch(e => console.log(e));
} else {
  console.log("Access Granted!");
}

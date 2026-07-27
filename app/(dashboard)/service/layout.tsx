import { ReactNode } from "react";
import { ServiceModuleGate } from "@/components/service/ServiceModuleGate";
import { verifyAuth } from "@/lib/auth";
import { enforceServiceEntitlement } from "@/lib/serviceEntitlement";

export default async function ServiceLayout({ children }: { children: ReactNode }) {
  // Server-Side Route Enforcement (Eliminating "Ghost Module" pattern for all /service/* pages)
  const user = await verifyAuth();
  const entitlementErr = await enforceServiceEntitlement(user);

  // If unentitled, block server-side rendering of child pages and render the rich upsell banner directly!
  if (entitlementErr) {
    return (
      <div className="w-full h-full">
        <ServiceModuleGate forceLocked={true}>
          <div />
        </ServiceModuleGate>
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <ServiceModuleGate>
        {children}
      </ServiceModuleGate>
    </div>
  );
}

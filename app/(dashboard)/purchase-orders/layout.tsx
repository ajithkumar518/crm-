"use client";

import React from "react";
import { ModuleGate } from "@/components/ModuleGate";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export default function PurchaseOrdersLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGate module={MODULE_KEYS.PURCHASE_ORDERS}>
      <div className="w-full h-full">
        {children}
      </div>
    </ModuleGate>
  );
}

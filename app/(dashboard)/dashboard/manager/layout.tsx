"use client";

import React from "react";
import { ModuleGate } from "@/components/ModuleGate";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";

export default function ManagerDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ModuleGate module={MODULE_KEYS.MANAGER_DASHBOARD}>
      <div className="w-full h-full">
        {children}
      </div>
    </ModuleGate>
  );
}

"use client";

import { ReactNode } from "react";
import { Lock, Wrench, Calendar, CheckCircle2, AlertTriangle, Clock, ShieldCheck, UserCheck, FileText, Plus } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export interface ServiceModuleGateProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  forceLocked?: boolean;
  children: ReactNode;
}

function renderServiceMockContent() {
  return (
    <div className="space-y-4 text-left font-sans">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-64 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center px-3 text-slate-400 text-xs">
            Search service tickets, AMCs, serial numbers...
          </div>
          <div className="h-8 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center text-slate-500 text-xs gap-1.5">
            Status: Active Operations
          </div>
        </div>
        <div className="h-8 px-3.5 bg-[var(--primary)] text-white font-bold rounded-lg flex items-center text-xs gap-1">
          <Plus size={14} /> New Service Request
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">Active AMC Contracts</div>
          <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1">42</div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">Scheduled Visits Today</div>
          <div className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-1">8</div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">Pending Complaints</div>
          <div className="text-lg font-bold text-amber-600 mt-1">3</div>
        </div>
        <div className="p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200/60 dark:border-slate-800">
          <div className="text-[11px] text-slate-400 font-medium">Warranty Claims</div>
          <div className="text-lg font-bold text-emerald-600 mt-1">98.4%</div>
        </div>
      </div>

      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
            <th className="py-2.5 px-3">Ticket ID</th>
            <th className="py-2.5 px-3">Customer & Asset</th>
            <th className="py-2.5 px-3">Service Type</th>
            <th className="py-2.5 px-3">Assigned Engineer</th>
            <th className="py-2.5 px-3">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-350">
          <tr>
            <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">REQ-2026-0089</td>
            <td className="py-3 px-3 font-medium">Tata Motors Ltd. — Hydraulic Press 100T</td>
            <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] bg-blue-50 text-blue-700 font-medium">Preventive AMC</span></td>
            <td className="py-3 px-3 flex items-center gap-1.5"><UserCheck size={13} className="text-slate-400" /> Rajesh Kumar</td>
            <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">In Progress</span></td>
          </tr>
          <tr>
            <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">CMP-2026-0042</td>
            <td className="py-3 px-3 font-medium">Bosch India Ltd. — PLC Control Panel</td>
            <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] bg-amber-50 text-amber-700 font-medium">Breakdown Visit</span></td>
            <td className="py-3 px-3 flex items-center gap-1.5"><UserCheck size={13} className="text-slate-400" /> Amit Patel</td>
            <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Pending Spares</span></td>
          </tr>
          <tr>
            <td className="py-3 px-3 font-mono font-bold text-slate-800 dark:text-slate-200">WAR-2026-0015</td>
            <td className="py-3 px-3 font-medium">JSW Steel Ltd. — CNC Bracket Assembly</td>
            <td className="py-3 px-3"><span className="px-2 py-0.5 rounded text-[10px] bg-purple-50 text-purple-700 font-medium">Warranty Claim</span></td>
            <td className="py-3 px-3 flex items-center gap-1.5"><UserCheck size={13} className="text-slate-400" /> Vikram Sharma</td>
            <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Under Review</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export function ServiceModuleGate({
  title = "Service CRM & AMC Operations",
  subtitle = "Complete after-sales field service, AMC tracking, warranty claims, and maintenance management.",
  icon = <Wrench className="w-5 h-5 text-[var(--primary)]" />,
  forceLocked = false,
  children,
}: ServiceModuleGateProps) {
  const { user } = useAuth();

  // If auth is not yet loaded, or if user is entitled (serviceCrmEnabled === true), allow rendering children.
  // Fail-closed enforcement: if forceLocked is true or if user is loaded and serviceCrmEnabled is not true, show lock screen.
  const isEntitled = !forceLocked && (!user || (user.serviceCrmEnabled === true || user.company?.serviceCrmEnabled === true) && user.disableServiceCrm !== true);

  if (isEntitled) {
    return <>{children}</>;
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-sm my-4">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2.5 border-b border-slate-200 dark:border-slate-800">
        {icon}
        <div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            {title}
            <Lock size={14} className="text-amber-500" />
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="relative overflow-hidden w-full min-h-[280px]">
        {/* Blurred background mock content - pointer events disabled */}
        <div className="filter blur-[6px] pointer-events-none select-none opacity-80 p-6 transition-all duration-300">
          {renderServiceMockContent()}
        </div>

        {/* Centered Lock Badge Overlay - completely non-interactive */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/15 dark:bg-slate-950/35 backdrop-blur-[1px] p-4 select-none">
          <div className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-slate-900 dark:bg-slate-800 text-white shadow-2xl border border-slate-700/60 transform -translate-y-1">
            <Lock size={16} className="text-amber-400 shrink-0" />
            <span className="text-sm font-bold tracking-wide">
              Service CRM License Required
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2.5 px-3 py-1 rounded-md bg-white/90 dark:bg-slate-900/90 shadow-sm border border-slate-200/60 dark:border-slate-800 text-center max-w-md">
            The Service CRM add-on (AMC tracking, field visits, inventory, and warranty claims) is not enabled for your company. Please contact support or upgrade your plan.
          </p>
        </div>
      </div>
    </div>
  );
}

export function useServiceEntitled(): boolean {
  const { user } = useAuth();
  if (!user) return true; // Fail open while loading auth
  return (user.serviceCrmEnabled === true || user.company?.serviceCrmEnabled === true) && user.disableServiceCrm !== true;
}

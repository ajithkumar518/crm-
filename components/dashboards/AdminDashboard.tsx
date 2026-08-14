"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { PageShell } from "@/components/ui/PageShell";
import {
  Users, TrendingUp, IndianRupee, Clock, CalendarCheck,
  ArrowUpRight, ArrowDownRight, Activity,
  FileText, CheckCircle, XCircle, Truck, AlertTriangle, PackageX, Target,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler,
} from "chart.js";
import { Line, Doughnut, Bar } from "react-chartjs-2";

// Modals
import InboundCheckInModal from "@/components/InboundCheckInModal";
import OutboundCheckInModal from "@/components/OutboundCheckInModal";
import CheckOutModal from "@/components/CheckOutModal";
import { SalesFunnelChart, RecentLeadsTableWidget, AgentLeaderboard, CrossModuleBentoGrid, OverallCRMHealthScore, RecentActivityFeed, WinLossSummaryWidget, ForecastVsTargetWidget, FollowUpTrendWidget } from "./SalesWidgets";
import { CountUp } from "@/components/ui/CountUp";

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Tooltip, Legend, Filler
);

// ─── Overall KPI Strip (SUKI CRM metrics) ────────────────────────────────────
function KpiStrip({ sukiData }: any) {
  const data = sukiData || {};
  const accentColor = "var(--accent)";

  const kpis = [
    { label: "Total Leads", value: data.totalLeadsReceived ?? 0, trend: "All time", up: data.totalLeadsReceived > 0, icon: <Users size={20} />, color: accentColor, bg: "var(--accent-soft)" },
    { label: "New Leads", value: data.newLeads ?? 0, trend: "This month", up: data.newLeads > 0, icon: <TrendingUp size={20} />, color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    { label: "Quotations Sent", value: data.quotationsSent ?? 0, trend: "Awaiting response", up: data.quotationsSent > 0, icon: <FileText size={20} />, color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
    { label: "Follow-up Pending", value: data.followUpPending ?? 0, trend: "Needs attention", up: data.followUpPending === 0, icon: <Clock size={20} />, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    { label: "Accepted", value: data.acceptedQuotations ?? 0, trend: "Won quotes", up: data.acceptedQuotations > 0, icon: <CheckCircle size={20} />, color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    { label: "Rejected", value: data.rejectedQuotations ?? 0, trend: "Lost quotes", up: data.rejectedQuotations === 0, icon: <XCircle size={20} />, color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    { label: "Converted Customers", value: data.convertedCustomers ?? 0, trend: "Order processing", up: data.convertedCustomers > 0, icon: <Target size={20} />, color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    { label: "Supplier Rate Checking", value: data.pendingSupplierRateChecking ?? 0, trend: "Pending rates", up: data.pendingSupplierRateChecking === 0, icon: <Truck size={20} />, color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
    { label: "Material Not Available", value: data.materialNotAvailable ?? 0, trend: "Unavailable", up: data.materialNotAvailable === 0, icon: <AlertTriangle size={20} />, color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
    { label: "No Stock", value: data.noStock ?? 0, trend: "Out of stock", up: data.noStock === 0, icon: <PackageX size={20} />, color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
      {kpis.map((k) => (
        <div key={k.label} className="bg-[var(--surface)] border border-[var(--border-subtle)] p-5 rounded-[24px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col gap-3 group cursor-default">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider">{k.label}</span>
            <span className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110" style={{ background: k.bg, color: k.color }}>
              {k.icon}
            </span>
          </div>
          <p className="text-[22px] sm:text-2xl font-black text-[var(--text-primary)] m-0 tracking-tight"><CountUp end={k.value} /></p>
          <div className="flex items-center gap-1.5 mt-auto pt-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: k.up ? "#10b981" : "#ef4444", background: k.up ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }}>
              {k.up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {k.up ? "Good" : "Action"}
            </span>
            <span className="text-[11px] font-medium text-[var(--text-muted)] truncate">{k.trend}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SUKI CRM Dashboard Section (mirrors /dashboard/crm) ─────────────────────
function SukiDashCard({ title, className, children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={"bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-[24px] flex flex-col hover:shadow-[0_8px_30px_rgba(0,0,0,0.03)] transition-all duration-300 " + (className || "")}>
      <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4 shrink-0">{title}</h3>
      {children}
    </div>
  );
}


function SukiCrmSection({ data }: { data: any }) {
  const [accentColor, setAccentColor] = useState("#2563EB");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateColors = () => {
      const style = window.getComputedStyle(document.documentElement);
      const acc = style.getPropertyValue("--accent").trim();
      if (acc) setAccentColor(acc);
    };
    updateColors();
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  if (!data) return null;

  const palette = [accentColor, accentColor + "CC", accentColor + "99", accentColor + "66", accentColor + "44", accentColor + "33", accentColor + "22", accentColor + "11"];

  const execData = data.executivePerformance || [];
  const sourceData = data.leadSourcePerformance || [];
  const totalSourceLeads = sourceData.reduce((s: number, x: any) => s + (x.count || 0), 0);

  const execChart = {
    labels: execData.map((e: any) => e.name),
    datasets: [{ label: "Customers", data: execData.map((e: any) => e.count), backgroundColor: accentColor, borderRadius: 6, barThickness: 28, maxBarThickness: 40 }],
  };

  const execOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { beginAtZero: true, grid: { color: "rgba(148,163,184,0.12)" }, ticks: { precision: 0, font: { size: 10 } } },
    },
  };

  const sourceChart = {
    labels: sourceData.map((s: any) => s.name),
    datasets: [{ data: sourceData.map((s: any) => s.count), backgroundColor: palette.slice(0, Math.max(sourceData.length, 1)), borderWidth: 0, hoverOffset: 4, cutout: "72%" }],
  };

  const sourceOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const val = ctx.raw;
            const pct = totalSourceLeads > 0 ? Math.round((val / totalSourceLeads) * 100) : 0;
            return ` ${ctx.label}: ${val} (${pct}%)`;
          },
        },
      },
    },
  };

  const conversionPct = parseFloat(data.conversionRatio) || 0;

  return (
    <section className="space-y-6 mb-10">
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <SukiDashCard title="Marketing Executive-wise Performance" className="xl:col-span-2 h-[360px]">
          {execData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center"><p className="text-xs text-[var(--text-muted)] italic">No executive data available</p></div>
          ) : (
            <div className="flex-1 min-h-0"><Bar data={execChart} options={execOptions} /></div>
          )}
        </SukiDashCard>

        <SukiDashCard title="Lead Source-wise Performance" className="h-[360px] justify-between">
          {totalSourceLeads === 0 ? (
            <div className="flex-1 flex items-center justify-center"><p className="text-xs text-[var(--text-muted)] italic">No lead source data available</p></div>
          ) : (
            <>
              <div className="relative w-full h-[150px] flex items-center justify-center shrink-0">
                <Doughnut data={sourceChart} options={sourceOptions} />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-0.5">Leads</span>
                  <span className="text-2xl font-black text-[var(--text-primary)] tracking-tight leading-none">{totalSourceLeads}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4 text-[10px] font-bold text-[var(--text-muted)]">
                {sourceData.slice(0, 6).map((s: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-1.5 last:border-0">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: palette[idx % palette.length] }} />
                      <span className="truncate">{s.name}</span>
                    </div>
                    <span className="text-[var(--text-primary)] pl-1 shrink-0">{s.count} ({totalSourceLeads > 0 ? Math.round((s.count / totalSourceLeads) * 100) : 0}%)</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </SukiDashCard>
      </div>

    </section>
  );
}

// ─── SUKI Side Cards (Conversion + Quotation status) ──────────────────────────
function SukiSideCards({ data }: { data: any }) {
  const [accentColor, setAccentColor] = useState("#2563EB");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateColors = () => {
      const style = window.getComputedStyle(document.documentElement);
      const acc = style.getPropertyValue("--accent").trim();
      if (acc) setAccentColor(acc);
    };
    updateColors();
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  if (!data) return null;
  const palette = [accentColor, accentColor + "CC", accentColor + "99", accentColor + "66", accentColor + "44", accentColor + "33", accentColor + "22", accentColor + "11"];
  const conversionPct = parseFloat(data.conversionRatio) || 0;

  return (
    <div className="flex flex-col gap-6 h-full">
      <SukiDashCard title="Monthly Lead Conversion Ratio" className="h-[180px] justify-between">
        <div className="flex-1 flex flex-col items-center justify-center">
          <p className="text-[32px] font-black tracking-tight leading-none" style={{ color: accentColor }}>{conversionPct.toFixed(2)}%</p>
          <p className="text-[11px] text-[var(--text-muted)] mt-2 text-center">Converted vs total leads this month</p>
        </div>
        <div className="w-full h-2 rounded-full bg-[var(--surface-2)] overflow-hidden shrink-0">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(conversionPct, 100)}%`, backgroundColor: accentColor }} />
        </div>
      </SukiDashCard>

      <SukiDashCard title="Quotation Status Breakdown" className="flex-1 h-[340px]">
        <div className="flex-1 overflow-y-auto pr-1 min-h-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(data.quotationStatusCounts || []).map((s: any, idx: number) => (
              <div key={s.name} className="flex items-center justify-between p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: palette[idx % palette.length] }} />
                  <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider truncate">{s.name}</span>
                </div>
                <span className="text-base font-black text-[var(--text-primary)] shrink-0 pl-2">{s.count}</span>
              </div>
            ))}
            {(!data.quotationStatusCounts || data.quotationStatusCounts.length === 0) && (
              <p className="text-xs text-[var(--text-muted)] italic col-span-full">No quotations yet</p>
            )}
          </div>
        </div>
      </SukiDashCard>
    </div>
  );
}

// ─── Sales Bar Chart Card (like Executive Performance) ────────────────────────
function SalesBarCard({ salesData }: { salesData: any }) {
  const [accentColor, setAccentColor] = useState("#2563EB");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateColors = () => {
      const style = window.getComputedStyle(document.documentElement);
      const acc = style.getPropertyValue("--accent").trim();
      if (acc) setAccentColor(acc);
    };
    updateColors();
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => observer.disconnect();
  }, []);

  const trend = salesData?.revenueTrend || [];
  const labels = trend.length ? trend.map((t: any) => t.month) : ["No Data"];
  const revenuePoints = trend.length ? trend.map((t: any) => t.revenue) : [0];

  const data = {
    labels,
    datasets: [{
      label: "Revenue",
      data: revenuePoints,
      backgroundColor: accentColor,
      borderRadius: 6,
      barThickness: 28,
      maxBarThickness: 40,
    }],
  };

  const options: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { beginAtZero: true, grid: { color: "rgba(148,163,184,0.12)" }, ticks: { precision: 0, font: { size: 10 } } },
    },
  };

  return (
    <SukiDashCard title="Sales Analytics" className="h-full">
      {trend.length === 0 ? (
        <div className="flex-1 flex items-center justify-center"><p className="text-xs text-[var(--text-muted)] italic">No sales data available</p></div>
      ) : (
        <div className="flex-1 min-h-0"><Bar data={data} options={options} /></div>
      )}
    </SukiDashCard>
  );
}

// ─── Main AdminDashboard ─────────────────────────────────────────────────────
export default function AdminDashboard({ dashboardData, salesData, sukiData, user, loadData, dateRange, setDateRange }: any) {
  const loading = !dashboardData;
  const { formatCurrency } = useCurrency();

  // Modal states
  const [isInboundOpen,     setIsInboundOpen]     = useState(false);
  const [isOutboundOpen,    setIsOutboundOpen]    = useState(false);
  const [isCheckoutOpen,    setIsCheckoutOpen]    = useState(false);
  const [activeCheckoutVisit, setActiveCheckoutVisit] = useState<any>(null);

  const handleOpenCheckout = (visitItem: any, type: "Inbound" | "Outbound") => {
    setActiveCheckoutVisit({
      id: visitItem.id,
      customerId: visitItem.customerId || visitItem.customer?.id,
      customerName: visitItem.customerName || visitItem.customer?.name || "Unknown",
      customerCode: visitItem.customerCode || visitItem.customer?.customerCode || "—",
      visitType: type,
      purpose: visitItem.purpose || "Meeting",
      checkInTime: visitItem.checkInTime || visitItem.checkIn,
    });
    setIsCheckoutOpen(true);
  };

  return (
    <PageShell
      title="Dashboards Overview"
      subtitle="Master consolidated view of sales, pipeline, and module activity"
      action={
        <div className="flex items-center gap-2">
          <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="input-field py-2 text-xs h-9 font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 outline-none focus:ring-2 focus:ring-[var(--primary)] cursor-pointer">
            <option value="alltime">All Time</option>
            <option value="last30days">Last 30 Days</option>
            <option value="last3months">Last 3 Months</option>
            <option value="last6months">Last 6 Months</option>
          </select>
        </div>
      }
    >
      {/* ── 1. Overall CRM KPI Strip ── */}
      <KpiStrip sukiData={sukiData} />

      {/* ── SUKI CRM Analytics (charts) ── */}
      <SukiCrmSection data={sukiData} />

      {/* ── 2. Main Analytics Row (Sales Analytics + Side Cards) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">
        <div className="xl:col-span-3 h-[360px]">
          <SalesBarCard salesData={salesData} />
        </div>
        <div className="xl:col-span-1 h-[360px]">
          <SukiSideCards data={sukiData} />
        </div>
      </div>

      {/* ── 3. Row 3: Funnel, Quota, & Lead Sources ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="h-[340px]">
          <SalesFunnelChart funnel={salesData?.funnel || []} />
        </div>
        <div className="h-[340px]">
          <WinLossSummaryWidget kpis={salesData?.kpis} />
        </div>
        <div className="h-[340px]">
          <ForecastVsTargetWidget kpis={salesData?.kpis} agentPerformance={salesData?.agentPerformance || []} />
        </div>
      </div>

      {/* ── 4. Row 4: Leadership, Follow-up, & Action Alerts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <div className="h-[340px]">
          <AgentLeaderboard agentPerformance={salesData?.agentPerformance || []} />
        </div>
        <div className="h-[340px]">
          <FollowUpTrendWidget followUpMetrics={dashboardData?.stats?.followUpMetrics} />
        </div>
        <div className="h-[340px]">
          <RecentActivityFeed needsAttention={salesData?.needsAttention} crossModule={salesData?.crossModule} />
        </div>
      </div>

      {/* ── 5. Row 5: Operational Details & Modules (Option A) ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Left Column (3/4 width) */}
        <div className="xl:col-span-3 flex flex-col gap-6">
          <CrossModuleBentoGrid crossModule={salesData?.crossModule} />
          <RecentLeadsTableWidget recentLeads={dashboardData?.recentLeads || []} />
        </div>
        
        {/* Right Rail (1/4 width) */}
        <div className="xl:col-span-1 flex flex-col gap-6">
          {/* @ts-ignore */}
          <OverallCRMHealthScore kpis={salesData?.kpis} crossModule={salesData?.crossModule} />
        </div>
      </div>


      {/* ── Modals ── */}
      <InboundCheckInModal
        isOpen={isInboundOpen}
        onClose={() => setIsInboundOpen(false)}
        onSuccess={loadData}
        loggedInUser={user ? { name: user.name, id: user.id } : null}
      />
      <OutboundCheckInModal
        isOpen={isOutboundOpen}
        onClose={() => setIsOutboundOpen(false)}
        onSuccess={loadData}
        loggedInUser={user ? { name: user.name, id: user.id } : null}
      />
      <CheckOutModal
        isOpen={isCheckoutOpen}
        onClose={() => {
          setIsCheckoutOpen(false);
          setActiveCheckoutVisit(null);
        }}
        onSuccess={loadData}
        visit={activeCheckoutVisit}
      />
    </PageShell>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { CRMSpinner } from "@/components/CRMSpinner";
import { CountUp } from "@/components/ui/CountUp";
import { cn } from "@/lib/ui-utils";
import {
  Users, FileText, Clock, CheckCircle, XCircle, Truck, AlertTriangle,
  PackageX, TrendingUp, ArrowUpRight, ArrowDownRight, Target,
} from "lucide-react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar, Doughnut } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

// ─── Shared card wrapper (matches CRM dashboard cards) ────────────────────────
function DashCard({ title, action, className, children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("bg-[var(--surface)] border border-[var(--border-subtle)] p-6 rounded-[24px] flex flex-col hover:shadow-[0_8px_30px_rgba(0,0,0,0.03)] transition-all duration-300", className)}>
      <div className="flex items-center justify-between mb-4 shrink-0">
        <h3 className="text-sm font-bold text-[var(--text-primary)]">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function KpiCard({ label, display, trend, up, icon, color, bg }: any) {
  return (
    <div className="bg-[var(--surface)] border border-[var(--border-subtle)] p-5 rounded-[24px] hover:shadow-[0_8px_30px_rgba(0,0,0,0.04)] transition-all duration-300 flex flex-col gap-3 group cursor-default">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-[var(--text-muted)] font-bold uppercase tracking-wider leading-tight pr-2">{label}</span>
        <span className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-110" style={{ background: bg, color }}>
          {icon}
        </span>
      </div>
      <p className="text-[22px] sm:text-2xl font-black text-[var(--text-primary)] m-0 tracking-tight">{display}</p>
      <div className="flex items-center gap-1.5 mt-auto pt-1">
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: up ? "#10b981" : "#ef4444", background: up ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.12)" }}>
          {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
          {up ? "Good" : "Action"}
        </span>
        <span className="text-[11px] font-medium text-[var(--text-muted)] truncate">{trend}</span>
      </div>
    </div>
  );
}

export default function CrmDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
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

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/suki");
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.message || "Failed to load");
    } catch {
      setError("Failed to load CRM dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <PageShell title="CRM Dashboard" subtitle="Loading SUKI metrics..."><CRMSpinner /></PageShell>;
  if (error) return <PageShell title="CRM Dashboard"><p className="text-rose-500 text-sm">{error}</p></PageShell>;
  if (!data) return <PageShell title="CRM Dashboard"><p className="text-[var(--text-muted)] text-sm">No data available</p></PageShell>;

  const palette = [accentColor, accentColor + "CC", accentColor + "99", accentColor + "66", accentColor + "44", accentColor + "33", accentColor + "22", accentColor + "11"];

  const kpis = [
    { label: "Total Leads", value: data.totalLeadsReceived, trend: "All time", up: data.totalLeadsReceived > 0, icon: <Users size={20} />, color: accentColor, bg: accentColor + "1F" },
    { label: "New Leads", value: data.newLeads, trend: "This month", up: data.newLeads > 0, icon: <TrendingUp size={20} />, color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    { label: "Quotations Sent", value: data.quotationsSent, trend: "Awaiting response", up: data.quotationsSent > 0, icon: <FileText size={20} />, color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
    { label: "Follow-up Pending", value: data.followUpPending, trend: "Needs attention", up: data.followUpPending === 0, icon: <Clock size={20} />, color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
    { label: "Accepted", value: data.acceptedQuotations, trend: "Won quotes", up: data.acceptedQuotations > 0, icon: <CheckCircle size={20} />, color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    { label: "Rejected", value: data.rejectedQuotations, trend: "Lost quotes", up: data.rejectedQuotations === 0, icon: <XCircle size={20} />, color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
    { label: "Converted Customers", value: data.convertedCustomers, trend: "Order processing", up: data.convertedCustomers > 0, icon: <Target size={20} />, color: "#10b981", bg: "rgba(16,185,129,0.12)" },
    { label: "Supplier Rate Checking", value: data.pendingSupplierRateChecking, trend: "Pending rates", up: data.pendingSupplierRateChecking === 0, icon: <Truck size={20} />, color: "#8b5cf6", bg: "rgba(139,92,246,0.12)" },
    { label: "Material Not Available", value: data.materialNotAvailable, trend: "Unavailable", up: data.materialNotAvailable === 0, icon: <AlertTriangle size={20} />, color: "#ec4899", bg: "rgba(236,72,153,0.12)" },
    { label: "No Stock", value: data.noStock, trend: "Out of stock", up: data.noStock === 0, icon: <PackageX size={20} />, color: "#6366f1", bg: "rgba(99,102,241,0.12)" },
  ];

  const execData = data.executivePerformance || [];
  const sourceData = data.leadSourcePerformance || [];
  const totalSourceLeads = sourceData.reduce((s: number, x: any) => s + (x.count || 0), 0);

  const execChart = {
    labels: execData.map((e: any) => e.name),
    datasets: [
      {
        label: "Leads Handled",
        data: execData.map((e: any) => e.leadsHandled),
        backgroundColor: "#3b82f6",
        borderRadius: 6,
        barThickness: 18,
        maxBarThickness: 30,
      },
      {
        label: "Quotations Sent",
        data: execData.map((e: any) => e.quotationsSent),
        backgroundColor: "#8b5cf6",
        borderRadius: 6,
        barThickness: 18,
        maxBarThickness: 30,
      },
      {
        label: "Deals Won",
        data: execData.map((e: any) => e.dealsWon),
        backgroundColor: "#10b981",
        borderRadius: 6,
        barThickness: 18,
        maxBarThickness: 30,
      },
    ],
  };

  const execOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: true, position: "bottom" as const, labels: { boxWidth: 12, font: { size: 10 } } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { beginAtZero: true, grid: { color: "rgba(148,163,184,0.12)" }, ticks: { precision: 0, font: { size: 10 } } },
    },
  };

  const sourceChart = {
    labels: sourceData.map((s: any) => s.name),
    datasets: [{
      data: sourceData.map((s: any) => s.count),
      backgroundColor: palette.slice(0, Math.max(sourceData.length, 1)),
      borderWidth: 0,
      hoverOffset: 4,
      cutout: "72%",
    }],
  };

  const sourceOptions = {
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
    <PageShell title="CRM Dashboard" subtitle="Consolidated view of SUKI leads, quotations, and conversions" className="space-y-6">
      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} display={<CountUp end={k.value} />} />
        ))}
      </div>

      {/* ── Row: Executive performance + Lead source ── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <DashCard title="Marketing Executive-wise Performance" className="xl:col-span-2 h-[360px]">
          {execData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-[var(--text-muted)] italic">No executive data available</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0">
              <Bar data={execChart} options={execOptions} />
            </div>
          )}
        </DashCard>

        <DashCard title="Lead Source-wise Performance" className="h-[360px] justify-between">
          {totalSourceLeads === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-xs text-[var(--text-muted)] italic">No lead source data available</p>
            </div>
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
                    <span className="text-[var(--text-primary)] pl-1 shrink-0">
                      {s.count} ({totalSourceLeads > 0 ? Math.round((s.count / totalSourceLeads) * 100) : 0}%)
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </DashCard>
      </div>

      {/* ── Row: Conversion ratio + Quotation status ── */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <DashCard title="Monthly Lead Conversion Ratio" className="h-[240px] justify-between">
          <div className="flex-1 flex flex-col items-center justify-center">
            <p className="text-[40px] font-black tracking-tight leading-none" style={{ color: accentColor }}>{conversionPct.toFixed(2)}%</p>
            <p className="text-[11px] text-[var(--text-muted)] mt-2 text-center">Converted vs total leads this month</p>
          </div>
          <div className="w-full h-2 rounded-full bg-[var(--surface-2)] overflow-hidden shrink-0">
            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(conversionPct, 100)}%`, backgroundColor: accentColor }} />
          </div>
        </DashCard>

        <DashCard title="Quotation Status Breakdown" className="xl:col-span-3 h-[240px]">
          <div className="flex-1 overflow-y-auto pr-1 min-h-0">
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
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
        </DashCard>
      </div>
    </PageShell>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";
import {
  AnalyticsPageHeader, KPICard, ComparisonBar, ChartCard,
  LoadingState, EmptyState,
} from "@/components/shared/AnalyticsComponents";
import { Download, Target, TrendingUp, BarChart3, CheckCircle2 } from "lucide-react";

const forecastTypes = ["Revenue", "Opportunity", "Sales"];

export default function TargetVsAchievementPage() {
  const toast = useToast();
  const { formatCurrency, convertAmount, preferredCurrency } = useCurrency();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [filters, setFilters] = useState({ year: String(new Date().getFullYear()), forecastType: "Revenue", assignedUserId: "" });

  useEffect(() => {
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.set("year", filters.year);
      if (filters.forecastType) params.set("forecastType", filters.forecastType);
      if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId);
      const res = await fetch(`/api/forecast/achievement?${params}`);
      const result = await res.json();
      if (result.success) setData(result.data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [filters.year, filters.forecastType, filters.assignedUserId]);

  const summary = useMemo(() => {
    const totalTarget = data.reduce((s, d) => s + (d.targetAmount ?? 0), 0);
    const totalAchieved = data.reduce((s, d) => s + (d.achievedAmount ?? 0), 0);
    const overallPct = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
    const onTrackMonths = data.filter(d => d.achievementPercent >= 80).length;
    const maxScale = Math.max(...data.map(d => Math.max(d.targetAmount, d.achievedAmount)), 1);
    return { totalTarget, totalAchieved, overallPct, onTrackMonths, maxScale };
  }, [data]);

  const handleExport = () => {
    const headers = ["Month", `Target (${preferredCurrency})`, `Achieved (${preferredCurrency})`, `Gap (${preferredCurrency})`, "Achievement %"];
    const rows = data.map(d => [d.monthName, d.targetAmount, d.achievedAmount, d.gap, `${d.achievementPercent}%`]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `target-vs-achievement-${filters.year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  };

  return (
    <PageContainer className="space-y-5 p-0">
      <AnalyticsPageHeader title="Target vs Achievement" subtitle="Compare forecast targets with actual achievement">
        <button onClick={handleExport} className="btn-primary"><Download size={16} /> Export CSV</button>
      </AnalyticsPageHeader>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Target" value={formatCurrency(summary.totalTarget)} icon={<Target size={20} />} />
        <KPICard label="Total Achieved" value={formatCurrency(summary.totalAchieved)} icon={<TrendingUp size={20} />} />
        <KPICard label="Overall Achievement" value={`${summary.overallPct}%`} icon={<BarChart3 size={20} />} />
        <KPICard label="On-Track Months" value={summary.onTrackMonths} sublabel="≥ 80% achievement" icon={<CheckCircle2 size={20} />} />
      </div>

      {/* Filter bar */}
      <div className="analytics-chart-card flex gap-3 flex-wrap items-end">
        <div><label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Year</label><input type="number" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} className="input-field" /></div>
        <div><label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Forecast Type</label><select value={filters.forecastType} onChange={(e) => setFilters({ ...filters, forecastType: e.target.value })} className="select-field">{forecastTypes.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">User</label><select value={filters.assignedUserId} onChange={(e) => setFilters({ ...filters, assignedUserId: e.target.value })} className="select-field"><option value="">All Users</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
      </div>

      {loading ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState message="No data available for the selected filters." />
      ) : (
        <ChartCard title="Target vs Achievement by Month" subtitle="Monthly forecast targets compared with actual achievement">
          <div className="space-y-3">
            {data.map((d, i) => (
              <ComparisonBar
                key={i}
                label={d.monthName}
                valueA={d.targetAmount}
                valueB={d.achievedAmount}
                labelA="Target"
                labelB="Achieved"
                formatValue={(v) => formatCurrency(v)}
                maxScale={summary.maxScale}
              />
            ))}
          </div>
        </ChartCard>
      )}

      {/* Detail table */}
      <div className="analytics-chart-card !p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th className="crm-th">Month</th>
                <th className="crm-th text-right">Target ({preferredCurrency})</th>
                <th className="crm-th text-right">Achieved ({preferredCurrency})</th>
                <th className="crm-th text-right">Gap ({preferredCurrency})</th>
                <th className="crm-th text-center">Achievement %</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={i} className="crm-tr">
                  <td className="crm-td text-[var(--text-primary)]">{d.monthName}</td>
                  <td className="crm-td text-right text-[var(--text-primary)]">{formatCurrency(d.targetAmount)}</td>
                  <td className="crm-td text-right text-[var(--text-primary)]">{formatCurrency(d.achievedAmount)}</td>
                  <td className={`crm-td text-right ${d.gap >= 0 ? "text-[var(--status-success-text)]" : "text-[var(--status-danger-text)]"}`}>{formatCurrency(d.gap)}</td>
                  <td className="crm-td text-center"><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${d.achievementPercent >= 80 ? "bg-green-100 text-green-700" : d.achievementPercent >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>{d.achievementPercent}%</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}

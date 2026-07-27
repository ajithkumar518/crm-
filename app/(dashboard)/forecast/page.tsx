"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import {
  AnalyticsPageHeader, KPICard, LoadingState, EmptyState,
} from "@/components/shared/AnalyticsComponents";
import { Plus, Pencil, Trash2, BarChart3, Target, TrendingUp, ListChecks } from "lucide-react";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const forecastTypes = ["Revenue", "Opportunity", "Sales"];

export default function ForecastListPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const { formatCurrency, preferredCurrency } = useCurrency();

  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [filters, setFilters] = useState({ year: String(new Date().getFullYear()), forecastType: "", assignedUserId: "" });
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });

  useEffect(() => {
    fetch("/api/users").then(res => res.json()).then(data => { if (data.success) setUsers(data.data || []); });
  }, []);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.year) params.set("year", filters.year);
      if (filters.forecastType) params.set("forecastType", filters.forecastType);
      if (filters.assignedUserId) params.set("assignedUserId", filters.assignedUserId);
      const res = await fetch(`/api/forecast?${params}`);
      const data = await res.json();
      if (data.success) setEntries(data.data);
    } catch { toast.error("Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadEntries(); }, [filters.year, filters.forecastType, filters.assignedUserId]);

  const summary = useMemo(() => {
    const totalTarget = entries.reduce((s, e) => s + (e.targetAmount ?? 0), 0);
    const totalAchieved = entries.reduce((s, e) => s + (e.achievedAmount ?? 0), 0);
    const overallPct = totalTarget > 0 ? Math.round((totalAchieved / totalTarget) * 100) : 0;
    return { totalTarget, totalAchieved, overallPct, totalEntries: entries.length };
  }, [entries]);

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true, title: "Delete Forecast Entry", message: "Are you sure?",
      action: async () => {
        try {
          const res = await fetch(`/api/forecast/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Deleted"); loadEntries(); }
          else toast.error(data.message || "Failed");
        } catch { toast.error("Failed"); }
        setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
      },
    });
  };

  const achievementColor = (percent: number) => {
    if (percent >= 80) return "bg-green-100 text-green-700";
    if (percent >= 50) return "bg-amber-100 text-amber-700";
    return "bg-red-100 text-red-700";
  };

  return (
    <PageContainer className="space-y-5 p-0">
      <AnalyticsPageHeader title="Forecast Overview" subtitle="Manage forecast targets and track achievement">
        <div className="flex gap-2">
          <button onClick={() => router.push("/forecast/target-vs-achievement")} className="btn-secondary"><BarChart3 size={16} /> Target vs Achievement</button>
          <button onClick={() => router.push("/forecast/new")} className="btn-primary"><Plus size={16} /> Add Forecast Entry</button>
        </div>
      </AnalyticsPageHeader>

      {/* Summary KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard label="Total Target" value={formatCurrency(summary.totalTarget)} icon={<Target size={20} />} />
        <KPICard label="Total Achieved" value={formatCurrency(summary.totalAchieved)} icon={<TrendingUp size={20} />} />
        <KPICard label="Overall Achievement" value={`${summary.overallPct}%`} icon={<BarChart3 size={20} />} />
        <KPICard label="Total Entries" value={summary.totalEntries} icon={<ListChecks size={20} />} />
      </div>

      {/* Filter bar */}
      <div className="analytics-chart-card flex gap-3 flex-wrap items-end">
        <div><label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Year</label><input type="number" value={filters.year} onChange={(e) => setFilters({ ...filters, year: e.target.value })} className="input-field" /></div>
        <div><label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Forecast Type</label><select value={filters.forecastType} onChange={(e) => setFilters({ ...filters, forecastType: e.target.value })} className="select-field"><option value="">All</option>{forecastTypes.map(t => <option key={t}>{t}</option>)}</select></div>
        <div><label className="block text-[12px] font-medium text-[var(--text-secondary)] mb-1">Assigned User</label><select value={filters.assignedUserId} onChange={(e) => setFilters({ ...filters, assignedUserId: e.target.value })} className="select-field"><option value="">All Users</option>{users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></div>
      </div>

      {loading ? (
        <LoadingState />
      ) : entries.length === 0 ? (
        <EmptyState message="No forecast entries found." />
      ) : (
        <div className="analytics-chart-card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th className="crm-th">Month</th>
                  <th className="crm-th">Year</th>
                  <th className="crm-th">Type</th>
                  <th className="crm-th text-right">Target ({preferredCurrency})</th>
                  <th className="crm-th text-right">Achieved ({preferredCurrency})</th>
                  <th className="crm-th text-center">Achievement %</th>
                  <th className="crm-th">Assigned To</th>
                  <th className="crm-th text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e: any) => (
                  <tr key={e.id} className="crm-tr">
                    <td className="crm-td text-[var(--text-primary)]">{months[e.month - 1]}</td>
                    <td className="crm-td text-[var(--text-primary)]">{e.year}</td>
                    <td className="crm-td text-[var(--text-primary)]">{e.forecastType}</td>
                    <td className="crm-td text-right text-[var(--text-primary)]">{formatCurrency(e.targetAmount)}</td>
                    <td className="crm-td text-right text-[var(--text-primary)]">{formatCurrency(e.achievedAmount)}</td>
                    <td className="crm-td text-center"><span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${achievementColor(e.targetAmount > 0 ? (e.achievedAmount / e.targetAmount) * 100 : 0)}`}>{e.targetAmount > 0 ? Math.round((e.achievedAmount / e.targetAmount) * 100) : 0}%</span></td>
                    <td className="crm-td text-[var(--text-primary)]">{e.assignedUser?.name || "—"}</td>
                    <td className="crm-td text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => router.push(`/forecast/${e.id}`)} className="action-icon-btn" title="Edit"><Pencil size={15} /></button>
                        <button onClick={() => handleDelete(e.id)} className="action-icon-btn row-action-btn-danger" title="Delete"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} onConfirm={confirmState.action} onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })} isDestructive={true} />
    </PageContainer>
  );
}
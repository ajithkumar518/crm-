"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import {
  Users, PhoneCall, TrendingUp, Target, Trophy, Clock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Legend, RadialBarChart, RadialBar, PolarAngleAxis,
} from "recharts";

interface ManagerDashboardData {
  leads: { new_today: number; total_open: number; overdue: number; sql: number; trend_last_week: number };
  followups: { due_today: number; overdue: number; pending: number };
  tasks: { pending: number; overdue: number; due_today: number };
  pipeline: { total_value: number; weighted_value: number; by_stage: { stage: string; color: string; count: number; total_value: number; weighted_value: number }[] };
  quotations: { sent_this_month: number; accepted_this_month: number; expiring_7_days: number; total_value_sent: number; total_value_accepted: number };
  rfqs: { pending_costing: number; overdue_due_date: number };
  visits: { planned_today: number; completed_this_week: number; missed_this_month: number };
  target: { monthly_target: number; achieved: number; achievement_pct: number; days_remaining_in_month: number };
  team_performance: { user_id: string; full_name: string; leads_count: number; pipeline_value: number; quotations_sent: number; visits_completed: number; achievement_pct: number }[];
  win_rate: number;
  avg_sales_cycle_days: number;
}

export default function ManagerDashboard() {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>("achievement_pct");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/manager");
      if (!res.ok) return;
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Manager dashboard fetch error:", err);
    }
  }, []);

  useEffect(() => {
    fetchData().finally(() => setLoading(false));
    const interval = setInterval(fetchData, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading || !data) {
    return (
      <PageShell title="Manager Dashboard" subtitle="Loading team KPIs...">
        <div className="flex items-center justify-center h-[40vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[var(--primary)]" />
        </div>
      </PageShell>
    );
  }

  const pipelineData = data.pipeline.by_stage.map((s) => ({
    name: s.stage,
    count: s.count,
    value: s.total_value,
  }));

  const quotationChartData = [
    { month: "This Month", Sent: data.quotations.sent_this_month, Accepted: data.quotations.accepted_this_month },
  ];

  // Target gauge data
  const achievementPct = Math.min(data.target.achievement_pct, 150);
  const gaugeColor = achievementPct < 50 ? "#EF4444" : achievementPct < 80 ? "#F59E0B" : achievementPct <= 100 ? "#10B981" : "#F59E0B";
  const gaugeData = [{ name: "Achievement", value: achievementPct, fill: gaugeColor }];

  // Sorted team performance
  const sortedTeam = [...data.team_performance].sort((a, b) => {
    const av = (a as any)[sortBy];
    const bv = (b as any)[sortBy];
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const topPerformer = [...data.team_performance].sort((a, b) => b.achievement_pct - a.achievement_pct)[0];
  const bottomPerformer = [...data.team_performance].sort((a, b) => a.achievement_pct - b.achievement_pct)[0];

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortBy(col);
      setSortDir("desc");
    }
  };

  return (
    <PageShell
      title="Manager Dashboard"
      subtitle={`Team overview — ${data.team_performance.length} executives`}
    >
      {/* Row 1 — KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <SummaryCard
          label="New Leads Today"
          value={data.leads.new_today}
          icon={<Users size={18} />}
          variant="light"
          trend={{ value: `${data.leads.trend_last_week} this week`, up: data.leads.trend_last_week > 0 }}
          subtitle="vs last 7 days"
        />
        <SummaryCard
          label="Follow-ups Due Today"
          value={data.followups.due_today}
          icon={<PhoneCall size={18} />}
          variant="dark"
          trend={{ value: `${data.followups.overdue} overdue`, up: false }}
          subtitle="team-wide"
        />
        <SummaryCard
          label="Pipeline Value (Weighted)"
          value={formatCurrency(data.pipeline.weighted_value)}
          icon={<TrendingUp size={18} />}
          variant="light"
          subtitle={`Total: ${formatCurrency(data.pipeline.total_value)}`}
        />
        <SummaryCard
          label="Monthly Achievement"
          value={`${data.target.achievement_pct}%`}
          icon={<Target size={18} />}
          variant="light"
          trend={{ value: `${data.target.days_remaining_in_month} days left`, up: true }}
          subtitle={`${formatCurrency(data.target.achieved)} / ${formatCurrency(data.target.monthly_target)}`}
        />
      </div>

      {/* Row 2 — Target Gauge + Win Rate + Avg Sales Cycle */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Target vs Achievement Gauge */}
        <div className="crm-card p-6">
          <h3 className="text-sm font-bold text-slate-800 mb-2">Target vs Achievement</h3>
          <ResponsiveContainer width="100%" height={200}>
            <RadialBarChart innerRadius="60%" outerRadius="100%" data={gaugeData} startAngle={180} endAngle={0}>
              <PolarAngleAxis type="number" domain={[0, 150]} tick={false} />
              <RadialBar background dataKey="value" cornerRadius={10} fill={gaugeColor} />
              <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle" className="text-2xl font-bold fill-slate-800">
                {data.target.achievement_pct}%
              </text>
            </RadialBarChart>
          </ResponsiveContainer>
          <p className="text-center text-xs text-slate-400">of Target</p>
        </div>

        {/* Win Rate */}
        <div className="crm-card p-6 flex flex-col items-center justify-center">
          <Trophy size={24} className="text-amber-500 mb-3" />
          <p className="text-4xl font-bold text-slate-800">{data.win_rate}%</p>
          <p className="text-xs text-slate-400 mt-2">Win Rate (This Month)</p>
        </div>

        {/* Avg Sales Cycle */}
        <div className="crm-card p-6 flex flex-col items-center justify-center">
          <Clock size={24} className="text-blue-500 mb-3" />
          <p className="text-4xl font-bold text-slate-800">{data.avg_sales_cycle_days}</p>
          <p className="text-xs text-slate-400 mt-2">Avg Sales Cycle (Days)</p>
        </div>
      </div>

      {/* Row 3 — Pipeline Funnel */}
      <div className="crm-card p-6 mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Pipeline by Stage</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={pipelineData} layout="vertical" margin={{ left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={100} />
            <Tooltip />
            <Bar dataKey="count" fill="#4472C4" radius={[0, 4, 4, 0]} name="Deals" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Row 4 — Quotations Chart */}
      <div className="crm-card p-6 mb-6">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Quotations — Sent vs Accepted</h3>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={quotationChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Sent" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Accepted" fill="#10B981" radius={[4, 4, 0, 0]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Row 5 — Team Performance Table */}
      <div className="crm-card p-6">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Team Performance</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-2 font-bold text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => handleSort("full_name")}>
                  Executive Name
                </th>
                <th className="text-right py-3 px-2 font-bold text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => handleSort("leads_count")}>
                  Leads (Open)
                </th>
                <th className="text-right py-3 px-2 font-bold text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => handleSort("pipeline_value")}>
                  Pipeline Value
                </th>
                <th className="text-right py-3 px-2 font-bold text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => handleSort("quotations_sent")}>
                  Quotations Sent
                </th>
                <th className="text-right py-3 px-2 font-bold text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => handleSort("visits_completed")}>
                  Visits Completed
                </th>
                <th className="text-right py-3 px-2 font-bold text-slate-500 cursor-pointer hover:text-slate-700" onClick={() => handleSort("achievement_pct")}>
                  Achievement %
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTeam.map((exec) => {
                const isTop = topPerformer?.user_id === exec.user_id;
                const isBottom = bottomPerformer?.user_id === exec.user_id && exec.achievement_pct < topPerformer.achievement_pct;
                return (
                  <tr key={exec.user_id} className={`border-b border-slate-100 ${isTop ? "bg-amber-50" : isBottom ? "bg-rose-50" : ""}`}>
                    <td className="py-3 px-2 font-bold text-slate-700">
                      {exec.full_name}
                      {isTop && <span className="ml-2 text-[10px] text-amber-600 font-bold">★ Top</span>}
                      {isBottom && <span className="ml-2 text-[10px] text-rose-600 font-bold">⚠ Low</span>}
                    </td>
                    <td className="text-right py-3 px-2 text-slate-600">{exec.leads_count}</td>
                    <td className="text-right py-3 px-2 text-slate-600">{formatCurrency(exec.pipeline_value)}</td>
                    <td className="text-right py-3 px-2 text-slate-600">{exec.quotations_sent}</td>
                    <td className="text-right py-3 px-2 text-slate-600">{exec.visits_completed}</td>
                    <td className="text-right py-3 px-2">
                      <span className={`font-bold ${exec.achievement_pct >= 80 ? "text-emerald-600" : exec.achievement_pct >= 50 ? "text-amber-600" : "text-rose-600"}`}>
                        {exec.achievement_pct}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}

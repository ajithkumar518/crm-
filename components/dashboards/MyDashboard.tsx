"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import {
  Users, PhoneCall, TrendingUp, Target, CheckCircle2, Clock,
  ArrowRight, AlertCircle, CalendarCheck, MapPin,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  ComposedChart, Legend,
} from "recharts";
import Link from "next/link";

interface DashboardData {
  leads: { new_today: number; total_open: number; overdue: number; sql: number; trend_last_week: number };
  followups: { due_today: number; overdue: number; pending: number };
  tasks: { pending: number; overdue: number; due_today: number };
  pipeline: { total_value: number; weighted_value: number; by_stage: { stage: string; color: string; count: number; total_value: number; weighted_value: number }[] };
  quotations: { sent_this_month: number; accepted_this_month: number; expiring_7_days: number; total_value_sent: number; total_value_accepted: number };
  rfqs: { pending_costing: number; overdue_due_date: number };
  visits: { planned_today: number; completed_this_week: number; missed_this_month: number };
  target: { monthly_target: number; achieved: number; achievement_pct: number; days_remaining_in_month: number };
}

export default function MyDashboard() {
  const { user } = useAuth();
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [followUpsToday, setFollowUpsToday] = useState<any[]>([]);
  const [overdueTasks, setOverdueTasks] = useState<any[]>([]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch("/api/dashboard/my");
      const json = await res.json();
      if (json.success) setData(json.data);
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  }, []);

  const fetchActionItems = useCallback(async () => {
    try {
      const [fuRes, taskRes] = await Promise.all([
        fetch("/api/follow-ups?status=Pending&limit=5"),
        fetch("/api/tasks?status=overdue&limit=5"),
      ]);
      const fuJson = await fuRes.json();
      const taskJson = await taskRes.json();
      if (fuJson.success || fuJson.followUps) setFollowUpsToday(fuJson.followUps || fuJson.data?.followUps || []);
      if (taskJson.success || taskJson.tasks) setOverdueTasks(taskJson.tasks || taskJson.data?.tasks || []);
    } catch (err) {
      console.error("Action items fetch error:", err);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchData(), fetchActionItems()]).finally(() => setLoading(false));
    // Auto-refresh every 15 minutes
    const interval = setInterval(() => {
      fetchData();
      fetchActionItems();
    }, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData, fetchActionItems]);

  if (loading || !data) {
    return (
      <PageShell title="My Dashboard" subtitle="Loading your KPIs...">
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

  // Quotations chart: last 3 months (simplified from current data)
  const quotationChartData = [
    { month: "This Month", Sent: data.quotations.sent_this_month, Accepted: data.quotations.accepted_this_month },
  ];

  return (
    <PageShell
      title="My Dashboard"
      subtitle={`Welcome back, ${user?.name}. Here's your snapshot for today.`}
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
          subtitle="needs attention"
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

      {/* Row 2 — Pipeline Funnel */}
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

      {/* Row 3 — Quotations Chart */}
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

      {/* Row 4 — Today's Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Follow-ups Due Today */}
        <div className="crm-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Follow-ups Due Today</h3>
            <Link href="/follow-ups" className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          {followUpsToday.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No follow-ups due today</p>
          ) : (
            <div className="space-y-3">
              {followUpsToday.slice(0, 5).map((f) => (
                <div key={f.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <PhoneCall size={16} className="text-slate-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">{f.customer?.name || f.lead?.name || "—"}</p>
                      <p className="text-[10px] text-slate-400">{f.type} • {f.nextMeetingDate ? new Date(f.nextMeetingDate).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                    </div>
                  </div>
                  <button className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Complete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Overdue Tasks */}
        <div className="crm-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-800">Overdue Tasks</h3>
            <Link href="/tasks" className="text-xs font-bold text-[var(--accent)] hover:underline flex items-center gap-1">
              View All <ArrowRight size={12} />
            </Link>
          </div>
          {overdueTasks.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center">No overdue tasks</p>
          ) : (
            <div className="space-y-3">
              {overdueTasks.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-rose-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <AlertCircle size={16} className="text-rose-400" />
                    <div>
                      <p className="text-xs font-bold text-slate-700">{t.title}</p>
                      <p className="text-[10px] text-rose-500">
                        {t.dueDate ? `Due: ${new Date(t.dueDate).toLocaleDateString()}` : "No due date"}
                        {t.priority && ` • ${t.priority}`}
                      </p>
                    </div>
                  </div>
                  <button className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Complete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Extra KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <div className="crm-card p-4 text-center">
          <CalendarCheck size={20} className="mx-auto text-blue-500 mb-2" />
          <p className="text-lg font-bold text-slate-800">{data.visits.planned_today}</p>
          <p className="text-[10px] text-slate-400">Visits Planned Today</p>
        </div>
        <div className="crm-card p-4 text-center">
          <MapPin size={20} className="mx-auto text-emerald-500 mb-2" />
          <p className="text-lg font-bold text-slate-800">{data.visits.completed_this_week}</p>
          <p className="text-[10px] text-slate-400">Visits Completed (Week)</p>
        </div>
        <div className="crm-card p-4 text-center">
          <Clock size={20} className="mx-auto text-amber-500 mb-2" />
          <p className="text-lg font-bold text-slate-800">{data.rfqs.pending_costing}</p>
          <p className="text-[10px] text-slate-400">RFQs Pending Costing</p>
        </div>
        <div className="crm-card p-4 text-center">
          <AlertCircle size={20} className="mx-auto text-rose-500 mb-2" />
          <p className="text-lg font-bold text-slate-800">{data.quotations.expiring_7_days}</p>
          <p className="text-[10px] text-slate-400">Quotations Expiring (7d)</p>
        </div>
      </div>
    </PageShell>
  );
}

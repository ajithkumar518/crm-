"use client";

import { useState, useEffect } from "react";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";
import { CRMSpinner } from "@/components/CRMSpinner";
import { CountUp } from "@/components/ui/CountUp";
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

const COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#ec4899", "#6366f1", "#14b8a6"];

function KpiCard({ label, value, color = "var(--primary)" }: { label: string; value: number; color?: string }) {
  return (
    <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
      <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>
        <CountUp end={value} />
      </p>
    </div>
  );
}

export default function SukiDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { formatCurrency } = useCurrency();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/dashboard/suki");
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.message || "Failed to load");
    } catch {
      setError("Failed to load SUKI dashboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <PageContainer><CRMSpinner /></PageContainer>;
  if (error) return <PageContainer><p className="text-rose-500">{error}</p></PageContainer>;
  if (!data) return <PageContainer><p className="text-[var(--text-tertiary)]">No data</p></PageContainer>;

  const execChart = {
    labels: data.executivePerformance.map((e: any) => e.name),
    datasets: [{
      label: "Customers",
      data: data.executivePerformance.map((e: any) => e.count),
      backgroundColor: COLORS,
    }],
  };

  const sourceChart = {
    labels: data.leadSourcePerformance.map((s: any) => s.name),
    datasets: [{
      data: data.leadSourcePerformance.map((s: any) => s.count),
      backgroundColor: COLORS,
    }],
  };

  return (
    <PageContainer className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">SUKI Steel CRM Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KpiCard label="Total Leads" value={data.totalLeadsReceived} />
        <KpiCard label="New Leads" value={data.newLeads} />
        <KpiCard label="Quotations Sent" value={data.quotationsSent} />
        <KpiCard label="Follow-up Pending" value={data.followUpPending} color="#f59e0b" />
        <KpiCard label="Accepted" value={data.acceptedQuotations} color="#10b981" />
        <KpiCard label="Rejected" value={data.rejectedQuotations} color="#ef4444" />
        <KpiCard label="Converted" value={data.convertedCustomers} color="#10b981" />
        <KpiCard label="Supplier Rate Checking" value={data.pendingSupplierRateChecking} color="#8b5cf6" />
        <KpiCard label="Material Not Available" value={data.materialNotAvailable} color="#ec4899" />
        <KpiCard label="No Stock" value={data.noStock} color="#6366f1" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Marketing Executive-wise Performance (Customers)</h2>
          <div className="h-64">
            <Bar data={execChart} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} />
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Lead Source-wise Performance</h2>
          <div className="h-64 flex justify-center">
            <Doughnut data={sourceChart} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Monthly Conversion Ratio</h2>
        <p className="text-3xl font-bold text-[var(--primary)]">{data.conversionRatio}%</p>
        <p className="text-xs text-[var(--text-tertiary)]">Converted vs total leads this month</p>
      </div>

      <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
        <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Quotation Status Breakdown</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {data.quotationStatusCounts.map((s: any) => (
            <div key={s.name} className="p-2 rounded-lg bg-[var(--surface)]">
              <p className="text-xs text-[var(--text-tertiary)]">{s.name}</p>
              <p className="text-lg font-semibold text-[var(--text-primary)]">{s.count}</p>
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ToastProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  download: "M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4 M7 10l5 5 5-5 M12 15V3",
};

export default function CompetitorAnalysisReportPage() {
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ from: "", to: "", competitorId: "" });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      if (filters.competitorId) params.set("competitorId", filters.competitorId);
      const res = await fetch(`/api/reports/competitor-analysis?${params}`);
      const d = await res.json();
      if (d.success) setData(d.data);
    } catch {
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filters]);

  const exportCSV = () => {
    if (!data?.byCompetitor?.length) return;
    const headers = ["Competitor", "Deals Lost", "Avg Their Price", "Avg Our Price", "Price Gap %", "Most Common Loss Reason"];
    const rows = data.byCompetitor.map((c: any) => [
      c.competitorName, c.lostCount, c.avgTheirPrice, c.avgOurPrice, c.priceGapPct, c.mostCommonLossReason,
    ]);
    const csv = [headers, ...rows].map(r => r.map((c: string | number) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "competitor-analysis.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const top5 = data?.byCompetitor?.slice(0, 5) ?? [];
  const maxLoss = Math.max(...top5.map((c: any) => c.lostCount), 1);

  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Competitor Analysis Report</h1>
          <p className="text-sm text-slate-500 mt-0.5">Loss analysis by competitor with price gap insights</p>
        </div>
        <button onClick={exportCSV} disabled={!data?.byCompetitor?.length} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50 disabled:opacity-50">
          <Ico d={icons.download} size={16} /> Export CSV
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        <span className="text-gray-400 text-sm">to</span>
        <input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500" />
        <select value={filters.competitorId} onChange={(e) => setFilters({ ...filters, competitorId: e.target.value })} className="px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All Competitors</option>
          {data?.competitors?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}</div>
      ) : !data ? (
        <div className="py-12 text-center text-sm text-gray-500">No data available.</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Total Deals Lost</p>
              <p className="text-2xl font-bold mt-1 text-red-600">{data.summary.totalLost}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Top Competitor by Loss Count</p>
              <p className="text-2xl font-bold mt-1 text-slate-800">{data.summary.topCompetitor}</p>
            </div>
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Avg Price Gap %</p>
              <p className="text-2xl font-bold mt-1 text-slate-800">{data.summary.avgPriceGapPct > 0 ? "+" : ""}{data.summary.avgPriceGapPct}%</p>
            </div>
          </div>

          {top5.length > 0 && (
            <div className="rounded-lg border bg-white p-5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-4">Losses per Competitor (Top 5)</h4>
              <div className="space-y-2">
                {top5.map((c: any) => (
                  <div key={c.competitorId} className="flex items-center gap-3 text-sm">
                    <div className="w-32 truncate text-gray-600">{c.competitorName}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-5 relative">
                      <div className="bg-red-500 rounded-full h-5 flex items-center justify-end pr-2" style={{ width: `${(c.lostCount / maxLoss) * 100}%` }}>
                        <span className="text-xs text-white font-medium">{c.lostCount}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.byCompetitor?.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Competitor</th>
                    <th className="px-4 py-3 font-semibold text-right">Deals Lost</th>
                    <th className="px-4 py-3 font-semibold text-right">Avg Their Price</th>
                    <th className="px-4 py-3 font-semibold text-right">Avg Our Price</th>
                    <th className="px-4 py-3 font-semibold text-right">Price Gap %</th>
                    <th className="px-4 py-3 font-semibold">Most Common Loss Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.byCompetitor.map((c: any) => (
                    <tr key={c.competitorId} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{c.competitorName}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{c.lostCount}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(c.avgTheirPrice)}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{formatCurrency(c.avgOurPrice)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${c.priceGapPct > 0 ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
                          {c.priceGapPct > 0 ? "+" : ""}{c.priceGapPct}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.mostCommonLossReason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-lg border bg-white p-12 text-center">
              <p className="text-sm text-gray-500">No competitor loss data found for the selected filters.</p>
            </div>
          )}
        </>
      )}
    </PageContainer>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { PageShell } from "@/components/ui/PageShell";
import { isQuotationFollowupAllowed } from "@/lib/feature-allowlist";
import { getQuotationsForFollowUpsAction } from "@/app/actions/followUps";
import { ChevronLeft, CalendarClock, Search, FileText, ArrowRight } from "lucide-react";

interface QuotationListItem {
  id: string;
  quotationCode: string;
  status: string;
  finalAmount: number;
  createdAt: string;
  customerName: string | null;
  followUpCount: number;
}

const statusColors: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-600",
  "Quotation Sent": "bg-blue-100 text-blue-700",
  UnderReview: "bg-amber-100 text-amber-700",
  Accepted: "bg-green-100 text-green-700",
  Rejected: "bg-red-100 text-red-700",
  "Follow-up": "bg-orange-100 text-orange-700",
  "Converted to Customer": "bg-emerald-100 text-emerald-700",
};

export default function QuotationFollowUpsIndexPage() {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [quotations, setQuotations] = useState<QuotationListItem[]>([]);
  const [filtered, setFiltered] = useState<QuotationListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const isFeatureUser = isQuotationFollowupAllowed(user?.email);

  useEffect(() => {
    if (user && !isFeatureUser) {
      toast.error("You do not have access to quotation follow-ups.");
      router.replace("/follow-up");
    }
  }, [user, isFeatureUser, router, toast]);

  useEffect(() => {
    if (!isFeatureUser) return;
    loadQuotations();
  }, [isFeatureUser]);

  const loadQuotations = async () => {
    setLoading(true);
    try {
      const res = await getQuotationsForFollowUpsAction();
      if (res.success && res.data) {
        // Sort by follow-up count descending, then by code
        const sorted = (res.data as QuotationListItem[]).sort((a, b) => {
          if (b.followUpCount !== a.followUpCount) return b.followUpCount - a.followUpCount;
          return a.quotationCode.localeCompare(b.quotationCode);
        });
        setQuotations(sorted);
        setFiltered(sorted);
      } else if (res.message?.startsWith("Unauthorized")) {
        toast.error(res.message);
        router.replace("/follow-up");
      }
    } catch (err) {
      console.error("Failed to load quotations:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let result = quotations;
    if (search.trim()) {
      const term = search.toLowerCase();
      result = result.filter(q =>
        q.quotationCode.toLowerCase().includes(term) ||
        (q.customerName || "").toLowerCase().includes(term)
      );
    }
    if (statusFilter !== "all") {
      result = result.filter(q => q.status === statusFilter);
    }
    setFiltered(result);
  }, [search, statusFilter, quotations]);

  if (!isFeatureUser && user) {
    return (
      <PageContainer className="p-6">
        <p className="text-slate-400">Redirecting...</p>
      </PageContainer>
    );
  }

  const uniqueStatuses = [...new Set(quotations.map(q => q.status))].sort();
  const totalFollowUps = quotations.reduce((sum, q) => sum + q.followUpCount, 0);

  return (
    <PageShell
      title="Quotation Follow-Ups"
      subtitle="Select a quotation to view and manage its follow-ups"
    >
      <PageContainer className="space-y">
        {/* Back link */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/follow-up")}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[var(--primary)] transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} /> Back to Follow-Ups
          </button>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="crm-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg">📋</div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Quotations</p>
              <p className="text-xl font-black text-slate-800">{quotations.length}</p>
            </div>
          </div>
          <div className="crm-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center text-lg">📅</div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Follow-Ups</p>
              <p className="text-xl font-black text-slate-800">{totalFollowUps}</p>
            </div>
          </div>
          <div className="crm-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-lg">✓</div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase">With Follow-Ups</p>
              <p className="text-xl font-black text-slate-800">{quotations.filter(q => q.followUpCount > 0).length}</p>
            </div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="crm-card p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <Search size={16} />
            </span>
            <input
              type="text"
              placeholder="Search by quotation code or customer name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/15 focus:border-[var(--primary)] transition-all font-medium text-slate-700"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold bg-slate-50 cursor-pointer focus:outline-none hover:bg-slate-100/60 transition-colors"
          >
            <option value="all">All Statuses</option>
            {uniqueStatuses.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Quotation Cards Grid */}
        {loading ? (
          <div className="crm-card p-12 text-center">
            <p className="text-slate-400 text-sm">Loading quotations...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="crm-card p-12 text-center">
            <FileText size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-400 text-sm">
              {quotations.length === 0 ? "No quotations found." : "No quotations match your search."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((q) => {
              const statusClass = statusColors[q.status] || "bg-slate-100 text-slate-600";
              return (
                <button
                  key={q.id}
                  onClick={() => router.push(`/follow-up/quotation/${q.id}`)}
                  className="crm-card p-5 text-left hover:shadow-lg hover:border-[var(--primary)]/30 transition-all cursor-pointer group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-lg shrink-0">
                        📋
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-800 group-hover:text-[var(--primary)] transition-colors">
                          {q.quotationCode}
                        </h3>
                        <p className="text-xs text-slate-500">{q.customerName || "—"}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${statusClass}`}>
                      {q.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <CalendarClock size={14} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-600">
                        {q.followUpCount} Follow-up{q.followUpCount !== 1 ? "s" : ""}
                      </span>
                      {q.followUpCount > 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-bold">
                          View
                        </span>
                      )}
                    </div>
                    <ArrowRight size={14} className="text-slate-300 group-hover:text-[var(--primary)] group-hover:translate-x-1 transition-all" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Summary footer */}
        {!loading && filtered.length > 0 && (
          <div className="text-center text-xs text-slate-400 pt-2">
            Showing {filtered.length} of {quotations.length} quotations
          </div>
        )}
      </PageContainer>
    </PageShell>
  );
}

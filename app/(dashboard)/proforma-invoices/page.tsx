"use client";

import { useState, useEffect, useCallback } from "react";
import PageContainer from "@/components/PageContainer";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Search } from "lucide-react";
import { StatusFilterBar, useStatusFromUrl } from "@/components/shared/StatusFilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";

const PROFORMA_STATUSES = [
  { label: "Draft", value: "Draft" },
  { label: "Sent", value: "Sent" },
  { label: "Approved", value: "Approved" },
  { label: "PO Received", value: "PO Received" },
  { label: "Cancelled", value: "Cancelled" },
];

export default function ProformaListPage() {
  const [proformas, setProformas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { formatCurrency } = useCurrency();
  const toast = useToast();
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const statusFilter = useStatusFromUrl("status");

  // "New Proforma from Quotation" modal state
  const [showGenModal, setShowGenModal] = useState(false);
  const [eligibleQuotations, setEligibleQuotations] = useState<any[]>([]);
  const [loadingEligible, setLoadingEligible] = useState(false);
  const [quotationSearch, setQuotationSearch] = useState("");
  const [selectedQuotationId, setSelectedQuotationId] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params: any = {};
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      
      const res = await fetch(`/api/proforma-invoices?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success) setProformas(data.data || []);
      else setError(data.message || "Failed to load");
    } catch {
      setError("Failed to load proformas");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const openGenModal = async () => {
    setShowGenModal(true);
    setSelectedQuotationId("");
    setQuotationSearch("");
    setLoadingEligible(true);
    try {
      // Fetch quotations (API returns 20 per page — fetch a few pages to cover eligible ones)
      const collected: any[] = [];
      for (let pg = 1; pg <= 10; pg++) {
        const res = await fetch(`/api/quotations?page=${pg}`);
        const data = await res.json();
        if (data.success && data.data?.length > 0) {
          collected.push(...data.data);
        } else {
          break;
        }
      }
      const eligible = collected.filter(
        (q: any) => q.status === "Accepted" || q.status === "Converted to Customer"
      );
      setEligibleQuotations(eligible);
    } catch {
      setEligibleQuotations([]);
    } finally {
      setLoadingEligible(false);
    }
  };

  const handleGenerate = async () => {
    if (!selectedQuotationId) {
      toast.error("Please select a quotation first");
      return;
    }
    setGenerating(true);
    try {
      // Reuse the existing endpoint — no duplicated logic
      const res = await fetch(`/api/quotations/${selectedQuotationId}/proforma`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Proforma generated");
        setShowGenModal(false);
        router.push(`/proforma-invoices/${data.data.id}`);
      } else {
        toast.error(data.message || "Failed to generate proforma");
      }
    } catch {
      toast.error("Failed to generate proforma");
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id: string, proformaNumber: string) => {
    if (!confirm(`Are you sure you want to delete proforma ${proformaNumber}? This action cannot be undone.`)) return;
    
    setDeletingId(id);
    try {
      const res = await fetch(`/api/proforma-invoices?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Proforma deleted successfully");
        load();
      } else {
        toast.error(data.message || "Failed to delete proforma");
      }
    } catch {
      toast.error("Failed to delete proforma");
    } finally {
      setDeletingId(null);
    }
  };

  const handleDownloadPdf = async (p: any) => {
    if (downloadingId) return;
    setDownloadingId(p.id);
    try {
      const res = await fetch(`/api/proforma-invoices/${p.id}/pdf`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        toast.error(data?.message || "Failed to generate PDF. The customer state or GSTIN may be missing.");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${p.proformaNumber || "proforma"}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to download PDF");
    } finally {
      setDownloadingId(null);
    }
  };

  const filteredQuotations = eligibleQuotations.filter((q: any) => {
    if (!quotationSearch) return true;
    const s = quotationSearch.toLowerCase();
    return (
      q.quotationCode?.toLowerCase().includes(s) ||
      q.customer?.name?.toLowerCase().includes(s) ||
      q.customer?.customerCode?.toLowerCase().includes(s)
    );
  });

  return (
    <PageContainer className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Proforma Invoices</h1>
        <button
          onClick={openGenModal}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white hover:opacity-90"
        >
          New Proforma from Quotation
        </button>
      </div>

      <StatusFilterBar
        statuses={PROFORMA_STATUSES}
        paramKey="status"
        basePath="/proforma-invoices"
      />

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search by PF number or QT number..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm pl-10 pr-4 py-2 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
        />
      </div>

      {loading && <CRMSpinner />}
      {error && <p className="text-rose-500 text-sm">{error}</p>}

      {!loading && proformas.length === 0 && (
        <p className="text-[var(--text-tertiary)] text-sm">No proforma invoices yet. Click &quot;New Proforma from Quotation&quot; to generate one from an accepted quotation.</p>
      )}

      <div className="space-y-2">
        {proformas.map((p: any) => (
          <div key={p.id} className={`p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-subtle)] ${p.SalesOrder ? "border-l-4 border-l-indigo-500" : ""}`}>
            <div className="flex items-center justify-between">
              <div>
                <Link href={`/proforma-invoices/${p.id}`} className="text-sm font-semibold text-[var(--primary)] hover:underline">{p.proformaNumber}</Link>
                <p className="text-xs text-[var(--text-tertiary)]">{p.customer?.customerCode} - {p.customer?.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge status={p.status} showDot size="sm" />
                  <span className="text-xs text-[var(--text-tertiary)]">· {p._count?.items || 0} items</span>
                </div>
                {p.SalesOrder && (
                  <p className="text-xs text-indigo-600 font-medium mt-1">📋 Sales Order: {p.SalesOrder.orderNumber}</p>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-[var(--primary)]">{formatCurrency(p.grandTotal)}</span>
                <button
                  onClick={() => handleDownloadPdf(p)}
                  disabled={downloadingId === p.id}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-60"
                >
                  {downloadingId === p.id ? "..." : "PDF"}
                </button>
                <button
                  onClick={() => handleDelete(p.id, p.proformaNumber)}
                  disabled={deletingId === p.id || p.SalesOrder}
                  className="text-xs px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  title={p.SalesOrder ? "Cannot delete proforma with linked sales order" : "Delete proforma"}
                >
                  {deletingId === p.id ? "Deleting..." : <Trash2 size={13} />}
                </button>
              </div>
            </div>
            {p.quotation?.quotationCode && (
              <p className="mt-2 text-xs text-[var(--text-tertiary)]">
                From quotation: <Link href={`/quotations/${p.quotation.id}`} className="text-[var(--primary)] hover:underline">{p.quotation.quotationCode}</Link>
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Generate Proforma Modal */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => !generating && setShowGenModal(false)}>
          <div className="bg-[var(--surface-1)] rounded-xl border border-[var(--border)] shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-[var(--border-subtle)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">New Proforma from Quotation</h2>
              <p className="text-xs text-[var(--text-tertiary)] mt-1">Select an accepted quotation to generate a proforma invoice.</p>
            </div>

            <div className="p-4 flex-1 overflow-y-auto">
              {loadingEligible ? (
                <div className="flex items-center justify-center py-8"><CRMSpinner /></div>
              ) : eligibleQuotations.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-[var(--text-tertiary)]">No eligible quotations found.</p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-1">Only quotations with status &quot;Accepted&quot; or &quot;Converted to Customer&quot; can be used to generate a proforma.</p>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    placeholder="Search by quotation code or customer..."
                    value={quotationSearch}
                    onChange={(e) => setQuotationSearch(e.target.value)}
                    className="w-full mb-3 px-3 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] text-sm text-[var(--text-primary)]"
                  />
                  <div className="space-y-1 max-h-64 overflow-y-auto">
                    {filteredQuotations.map((q: any) => (
                      <button
                        key={q.id}
                        onClick={() => setSelectedQuotationId(q.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-colors ${
                          selectedQuotationId === q.id
                            ? "border-[var(--primary)] bg-[var(--primary)]/10"
                            : "border-[var(--border-subtle)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-[var(--text-primary)]">{q.quotationCode}</p>
                            <p className="text-xs text-[var(--text-tertiary)]">{q.customer?.name} · {q.status}</p>
                          </div>
                          <span className="text-xs font-medium text-[var(--primary)]">{formatCurrency(q.finalAmount)}</span>
                        </div>
                      </button>
                    ))}
                    {filteredQuotations.length === 0 && (
                      <p className="text-xs text-[var(--text-tertiary)] text-center py-4">No quotations match your search.</p>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="p-4 border-t border-[var(--border-subtle)] flex justify-end gap-2">
              <button
                onClick={() => setShowGenModal(false)}
                disabled={generating}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--surface-3)] text-[var(--text-secondary)] hover:opacity-90"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={generating || !selectedQuotationId || eligibleQuotations.length === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {generating ? "Generating..." : "Generate Proforma"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}

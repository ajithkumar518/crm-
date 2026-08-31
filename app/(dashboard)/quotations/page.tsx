"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { useCurrency } from "@/components/CurrencyProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { CRMSpinner } from "@/components/CRMSpinner";
import { StatusFilterBar, useStatusFromUrl } from "@/components/shared/StatusFilterBar";
import { QUOTES_STATUS } from "@/lib/module-status-config";
import { useHasModule } from "@/components/ModuleGate";
import { MODULE_KEYS } from "@/lib/config/moduleVariantMap";
import { Modal } from "@/components/ui/Modal";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  x: "M6 18L18 6M6 6l12 12",
  copy: "M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z",
};

const statusStyles: Record<string, { badge: string; dot: string }> = {
  Draft: { badge: "bg-slate-50 text-slate-600 border-slate-200", dot: "bg-slate-400" },
  "Quotation Sent": { badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  "Follow-up": { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  "Revised Rate": { badge: "bg-cyan-50 text-cyan-700 border-cyan-200", dot: "bg-cyan-500" },
  Accepted: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  Rejected: { badge: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  MOQ: { badge: "bg-purple-50 text-purple-700 border-purple-200", dot: "bg-purple-500" },
  "Material Not Available": { badge: "bg-rose-50 text-rose-700 border-rose-200", dot: "bg-rose-500" },
  "No Stock": { badge: "bg-gray-50 text-gray-600 border-gray-200", dot: "bg-gray-500" },
  "Price Pending": { badge: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  "Supplier Rate Checking": { badge: "bg-sky-50 text-sky-700 border-sky-200", dot: "bg-sky-500" },
  "Converted to Customer": { badge: "bg-green-50 text-green-700 border-green-200", dot: "bg-green-600" },
  Others: { badge: "bg-zinc-50 text-zinc-600 border-zinc-200", dot: "bg-zinc-500" },
  // legacy styles
  Sent: { badge: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  UnderReview: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  Expired: { badge: "bg-gray-50 text-gray-500 border-gray-200", dot: "bg-gray-400" },
  PendingApproval: { badge: "bg-orange-50 text-orange-700 border-orange-200", dot: "bg-orange-500" },
  Approved: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  OnHold: { badge: "bg-zinc-50 text-zinc-600 border-zinc-200", dot: "bg-zinc-500" },
};

const customerCategoryStyles: Record<string, { badge: string }> = {
  "80-20": { badge: "bg-emerald-100 text-emerald-800 border-emerald-300" },
  "NON-80-20": { badge: "bg-amber-100 text-amber-800 border-amber-300" },
};

const formatQuotationDateTime = (dt: string | Date) => {
  const d = new Date(dt);
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).replace(/am/i, "AM").replace(/pm/i, "PM");
};

function QuotationListContent() {
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const toast = useToast();
  const { formatCurrency } = useCurrency();
  const [confirmState, setConfirmState] = useState<{ isOpen: boolean; title: string; message: string; action: () => void }>({ isOpen: false, title: "", message: "", action: () => {} });
  const [itemsModal, setItemsModal] = useState<{ open: boolean; quotationCode: string; items: any[] }>({ open: false, quotationCode: "", items: [] });

  const statusFilter = useStatusFromUrl("status");
  const searchParams = useSearchParams();
  const hasMod = useHasModule();

  // ── Additional filters ──────────────────────────────────────────────────
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [paymentTermsFilter, setPaymentTermsFilter] = useState("");
  const [assignedUserFilter, setAssignedUserFilter] = useState("");
  const [customerCategoryFilter, setCustomerCategoryFilter] = useState("");
  const [quantityWiseCategoryFilter, setQuantityWiseCategoryFilter] = useState("");
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => res.json())
      .then((data) => { if (data.success) setUsers(data.data || []); })
      .catch(() => {});
  }, []);

  const handleStatusFilterChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("status", value);
    else params.delete("status");
    router.push(`/quotations?${params.toString()}`, { scroll: false });
  };

  const hasActiveFilters = !!(statusFilter || dateFrom || dateTo || paymentTermsFilter || assignedUserFilter || customerCategoryFilter || quantityWiseCategoryFilter);

  const clearAllFilters = () => {
    setDateFrom("");
    setDateTo("");
    setPaymentTermsFilter("");
    setAssignedUserFilter("");
    setCustomerCategoryFilter("");
    setQuantityWiseCategoryFilter("");
    router.push("/quotations", { scroll: false });
  };

  const quoteStatuses = QUOTES_STATUS.filter((s) => {
    if (s.value === "UnderReview") return hasMod(MODULE_KEYS.NEGOTIATION);
    if (s.value === "Expired") return hasMod(MODULE_KEYS.RFQ);
    return true;
  });

  const [error, setError] = useState("");

  const loadQuotations = async () => {
    setLoading(true);
    setError("");
    try {
      const params: any = { page: String(page) };
      if (statusFilter) params.status = statusFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (paymentTermsFilter) params.paymentTerms = paymentTermsFilter;
      if (assignedUserFilter) params.assignedUserId = assignedUserFilter;
      if (customerCategoryFilter) params.customerCategory = customerCategoryFilter;
      if (quantityWiseCategoryFilter) params.quantityWiseCategory = quantityWiseCategoryFilter;
      const res = await fetch(`/api/quotations?${new URLSearchParams(params)}`);
      const data = await res.json();
      if (data.success) {
        setQuotations(data.data ?? []);
        setTotalPages(data.totalPages || 1);
        setTotal(data.total || 0);
      } else {
        setError(data.message || "Failed to load quotations");
      }
    } catch {
      setError("Failed to load quotations. Check your connection and try again.");
      toast.error("Failed to load quotations");
    } finally {
      setLoading(false);
    }
  };

  const isFirstFilterRun = useRef(true);
  useEffect(() => {
    if (isFirstFilterRun.current) {
      isFirstFilterRun.current = false;
      loadQuotations();
      return;
    }
    // Debounce so typing in the Payment Terms text filter doesn't fire a request per keystroke.
    const handle = setTimeout(() => {
      setPage(1);
      loadQuotations();
    }, 350);
    return () => clearTimeout(handle);
  }, [statusFilter, dateFrom, dateTo, paymentTermsFilter, assignedUserFilter, customerCategoryFilter, quantityWiseCategoryFilter]);

  useEffect(() => {
    loadQuotations();
  }, [page]);

  const scrollTable = (dir: "left" | "right") => {
    const el = tableScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -250 : 250, behavior: "smooth" });
  };

  const filtered = quotations.filter((q: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return q.quotationCode?.toLowerCase().includes(s) || q.customer?.name?.toLowerCase().includes(s);
  });

  const handleDelete = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Quotation",
      message: "Are you sure you want to delete this quotation?",
      action: async () => {
        try {
          const res = await fetch(`/api/quotations/${id}`, { method: "DELETE" });
          const data = await res.json();
          if (data.success) { toast.success("Quotation deleted"); loadQuotations(); }
          else toast.error(data.message || "Failed");
        } catch { toast.error("Failed"); }
        setConfirmState({ isOpen: false, title: "", message: "", action: () => {} });
      },
    });
  };



  return (
    <PageContainer className="space-y-4 p-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Quotations Overview</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage customer quotations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.open(`/api/quotations/export${statusFilter ? `?status=${statusFilter}` : ""}`, "_blank")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" /></svg>
            Export CSV
          </button>
          <button onClick={() => router.push("/quotations/new")} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer">
            <Ico d={icons.plus} size={16} /> New Quotation
          </button>
        </div>
      </div>

      <StatusFilterBar
        statuses={quoteStatuses}
        paramKey="status"
        basePath="/quotations"
      />

      {/* Search and filters — kept on a single, compact row */}
      <div className="flex items-center gap-2 overflow-x-auto">
        <div className="relative flex-shrink-0">
          <Ico d={icons.search} size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input type="text" placeholder="Search QUO or customer..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-44 h-8 pl-8 pr-3 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value)}
          className="h-8 px-2 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer"
        >
          <option value="">All Status</option>
          {quoteStatuses.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <select
          value={quantityWiseCategoryFilter}
          onChange={(e) => setQuantityWiseCategoryFilter(e.target.value)}
          className="h-8 px-2 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer"
        >
          <option value="">All Qty Categories</option>
          <option value="Low">Low</option>
          <option value="Medium">Medium</option>
          <option value="High">High</option>
        </select>

        <select
          value={customerCategoryFilter}
          onChange={(e) => setCustomerCategoryFilter(e.target.value)}
          className="h-8 px-2 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer"
        >
          <option value="">All Categories</option>
          <option value="80-20">80-20</option>
          <option value="NON-80-20">Non 80-20</option>
        </select>

        <select
          value={assignedUserFilter}
          onChange={(e) => setAssignedUserFilter(e.target.value)}
          className="h-8 px-2 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] cursor-pointer"
        >
          <option value="">All Assignees</option>
          {users.map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>

        <input
          type="text"
          placeholder="Payment terms..."
          value={paymentTermsFilter}
          onChange={(e) => setPaymentTermsFilter(e.target.value)}
          className="h-8 px-2.5 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] w-32"
        />

        <div className="flex items-center gap-1">
          <label className="text-[10px] text-slate-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 px-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] w-28"
          />
          <label className="text-[10px] text-slate-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 px-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-600 focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] w-28"
          />
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="h-8 px-2 text-xs font-semibold text-[var(--primary)] hover:text-[var(--primary-hover)] bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 whitespace-nowrap"
          >
            <Ico d={icons.x} size={12} /> Clear
          </button>
        )}
      </div>

      <div className="crm-card overflow-hidden">
        <div className="flex justify-end items-center px-3 py-2 border-b border-slate-100">
          <div className="flex items-center gap-1">
            <button
              onClick={() => scrollTable("left")}
              title="Scroll left"
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => scrollTable("right")}
              title="Scroll right"
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
        <div ref={tableScrollRef} className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th className="crm-th">QUO Code</th>
                <th className="crm-th">Quotation Date</th>
                <th className="crm-th">Customer</th>
                <th className="crm-th text-right">No. of Items</th>
                <th className="crm-th text-right">Total Qty</th>
                <th className="crm-th text-right">Total</th>
                <th className="crm-th text-right">Discount %</th>
                <th className="crm-th text-right">Final Amount</th>
                <th className="crm-th">Status</th>
                <th className="crm-th text-center">Qty Category</th>
                <th className="crm-th text-center">Customer Category</th>
                <th className="crm-th text-center">Margin</th>
                <th className="crm-th">Payment Terms</th>
                <th className="crm-th">Valid Until</th>
                <th className="crm-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={15} className="crm-td text-center py-12">
                    <div className="flex justify-center">
                      <CRMSpinner size={36} label="Loading quotations..." />
                    </div>
                  </td>
                </tr>
              ) : error ? (
                <tr><td colSpan={15} className="crm-td text-center py-8 text-red-500">{error}</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={15} className="crm-td text-center py-12 text-muted-foreground">
                  <div className="text-3xl mb-3">📄</div>
                  <p className="font-medium mb-1">No quotations found</p>
                  <p className="text-xs mb-4">
                    {statusFilter
                      ? `No quotations with status "${statusFilter}".`
                      : "No quotations have been created yet."}
                  </p>
                  <button
                    onClick={() => router.push("/quotations/new")}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors"
                  >
                    + Create First Quotation
                  </button>
                </td></tr>
              ) : (
                filtered.map((q: any) => (
                  <tr
                    key={q.id}
                    className="crm-tr table-row-clickable"
                    onClick={() => router.push(`/quotations/${q.id}?status=${q.status}`)}
                  >
                    <td className="crm-td font-medium text-foreground">
                      <div className="flex items-center gap-1.5">
                        {q.quotationCode}
                        {q.revisionNumber > 1 && (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 text-xs font-bold">R{q.revisionNumber}</span>
                        )}
                        {q.negotiationId && (
                          <a href={`/negotiations/${q.negotiationId}`} onClick={e => e.stopPropagation()} className="text-xs text-blue-600 hover:underline" title="Linked negotiation">NEG</a>
                        )}
                      </div>
                    </td>
                    <td className="crm-td text-foreground whitespace-nowrap text-sm">{q.createdAt ? formatQuotationDateTime(q.createdAt) : "—"}</td>
                    <td className="crm-td">
                      <span className="row-primary-link">{q.customer?.name || "—"}</span>
                    </td>
                    <td className="crm-td text-right" onClick={e => e.stopPropagation()}>
                      {q.items?.length > 0 ? (
                        <button
                          onClick={() => setItemsModal({ open: true, quotationCode: q.quotationCode, items: q.items })}
                          className="text-[var(--primary)] font-medium hover:underline cursor-pointer"
                          title="View item details"
                        >
                          {q.items.length}
                        </button>
                      ) : (
                        <span className="text-foreground">0</span>
                      )}
                    </td>
                    <td className="crm-td text-right text-foreground">{q.totalQuantity ? Number(q.totalQuantity).toFixed(2) : "—"}</td>
                    <td className="crm-td text-right text-foreground">{formatCurrency(q.totalAmount)}</td>
                    <td className="crm-td text-right text-foreground">{q.discountPercent}%</td>
                    <td className="crm-td text-right font-medium text-foreground">{formatCurrency(q.finalAmount)}</td>
                    <td className="crm-td"><span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${(statusStyles[q.status] || statusStyles.Draft).badge}`}><span className={`w-1.5 h-1.5 rounded-full ${(statusStyles[q.status] || statusStyles.Draft).dot}`} />{q.status}</span></td>
                    <td className="crm-td text-center text-foreground text-xs">{q.quantityWiseCategory || "—"}</td>
                    <td className="crm-td text-center"><span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${(customerCategoryStyles[q.customer?.customerCategory] || customerCategoryStyles["NON-80-20"]).badge}`}>{q.customer?.customerCategory || "—"}</span></td>
                    <td className="crm-td text-center">{q.overallMarginPercent != null ? <span className={`text-xs font-semibold ${Number(q.overallMarginPercent) >= 20 ? "text-emerald-600" : Number(q.overallMarginPercent) >= 15 ? "text-amber-600" : "text-rose-600"}`}>{Number(q.overallMarginPercent).toFixed(1)}%</span> : <span className="text-xs text-slate-400">—</span>}</td>
                    <td className="crm-td text-foreground text-sm whitespace-nowrap">{q.paymentTerms || "—"}</td>
                    <td className="crm-td text-foreground">{new Date(q.validUntil).toLocaleDateString()}</td>
                    <td className="crm-td text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => handleDelete(q.id)} className="row-action-btn row-action-btn-danger" title="Delete"><Ico d={icons.x} size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs text-slate-500">
            Showing <strong>{quotations.length}</strong> of <strong>{total}</strong> quotations
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <span className="text-sm font-medium text-slate-600 px-2">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg text-sm font-medium border border-slate-200 text-slate-600 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      )}

      <ConfirmModal isOpen={confirmState.isOpen} title={confirmState.title} message={confirmState.message} onConfirm={confirmState.action} onCancel={() => setConfirmState({ isOpen: false, title: "", message: "", action: () => {} })} isDestructive={true} />

      <Modal
        open={itemsModal.open}
        onClose={() => setItemsModal({ open: false, quotationCode: "", items: [] })}
        title="Quotation Items"
        subtitle={itemsModal.quotationCode}
        size="xl"
      >
        <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
          <table className="crm-table">
            <thead className="sticky top-0 bg-white dark:bg-[var(--surface)] z-10">
              <tr>
                <th className="crm-th">Product</th>
                <th className="crm-th">Material Grade</th>
                <th className="crm-th">Size</th>
                <th className="crm-th text-right">Length (mm)</th>
                <th className="crm-th text-right">Pcs</th>
                <th className="crm-th text-right">Rate</th>
              </tr>
            </thead>
            <tbody>
              {itemsModal.items.map((it: any, idx: number) => (
                <tr key={idx} className="crm-tr">
                  <td className="crm-td text-foreground">{it.product?.name || it.product?.productCode || "—"}</td>
                  <td className="crm-td text-foreground">{it.materialGrade || "—"}</td>
                  <td className="crm-td text-foreground">{it.materialSize || "—"}</td>
                  <td className="crm-td text-right text-foreground">{it.lengthMm != null ? it.lengthMm : "—"}</td>
                  <td className="crm-td text-right text-foreground">{it.numberOfPieces != null ? it.numberOfPieces : "—"}</td>
                  <td className="crm-td text-right text-foreground">{formatCurrency(it.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Modal>
    </PageContainer>
  );
}

export default function QuotationListPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[400px]"><div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-[var(--primary)] animate-spin" /></div>}>
      <QuotationListContent />
    </Suspense>
  );
}

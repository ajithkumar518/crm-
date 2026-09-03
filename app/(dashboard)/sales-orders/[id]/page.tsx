"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageContainer from "@/components/PageContainer";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import { useAuth } from "@/components/AuthProvider";
import { ChevronLeft, RefreshCw, CloudUpload, CheckCircle2, XCircle, Clock } from "lucide-react";

export default function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { formatCurrency } = useCurrency();
  const toast = useToast();
  const { user } = useAuth();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showErpPanel, setShowErpPanel] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/sales-orders/${id}`);
      const data = await res.json();
      if (data.success) setOrder(data.data);
      else toast.error(data.message || "Failed to load");
    } catch {
      toast.error("Failed to load sales order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleSyncErp = async () => {
    setSyncing(true);
    try {
      const res = await fetch(`/api/sales-orders/${id}/sync-erp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Successfully synced to ERP");
        setOrder(data.data);
      } else {
        toast.error(data.message || "ERP sync failed");
        // Reload to get the updated erpSyncStatus = "Failed"
        load();
      }
    } catch {
      toast.error("ERP sync failed");
      load();
    } finally {
      setSyncing(false);
    }
  };

  if (loading) return <PageContainer><CRMSpinner /></PageContainer>;
  if (!order) return <PageContainer><p className="text-rose-500 text-sm">Sales order not found.</p></PageContainer>;

  const items = order.items || [];
  const totalItems = items.length;
  const totalQuantity = items.reduce((s: number, it: any) => s + (it.quantity || 0), 0);
  const totalPieces = items.reduce((s: number, it: any) => s + (it.numberOfPieces || 0), 0);
  const customer8020 = order.customer?.customerCategory === "80-20" ? "80/20 Customer" : "Non-80/20 Customer";

  const canSyncErp = ["Open", "Confirmed"].includes(order.status);
  const canApproveDirectly = ["Admin", "SalesManager", "SuperAdmin"].includes(user?.role ?? "");
  const erpSynced = order.erpSyncStatus === "Synced";
  const erpFailed = order.erpSyncStatus === "Failed";
  const erpPending = order.erpSyncStatus === "Pending";

  const fields = [
    { label: "Customer Name", value: order.customer?.name || "—" },
    { label: "PO Date", value: order.orderDate ? new Date(order.orderDate).toLocaleDateString("en-IN") : "—" },
    { label: "No. of Items", value: totalItems },
    { label: "Total Quantity", value: `${totalQuantity.toFixed(3)} kgs` },
    { label: "Total Amount", value: formatCurrency(order.grandTotal) },
    { label: "Total No. of Pieces", value: totalPieces.toFixed(0) },
    { label: "Customer Classification", value: customer8020 },
  ];

  return (
    <PageContainer className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/sales-orders")} className="p-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--border)]"><ChevronLeft size={18} /></button>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{order.orderNumber}</h1>
        <span className="text-xs px-2 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)]">{order.status}</span>
        {erpSynced && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} /> ERP Synced
          </span>
        )}
        {erpFailed && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
            <XCircle size={12} /> ERP Sync Failed
          </span>
        )}
        {erpPending && (
          <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            <Clock size={12} /> Sync Pending
          </span>
        )}
      </div>

      {/* Summary fields */}
      <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-2 text-sm">
        {fields.map((f) => (
          <div key={f.label} className="flex justify-between items-center">
            <span className="text-[var(--text-tertiary)]">{f.label}</span>
            <span className="font-medium text-[var(--text-primary)]">{f.value}</span>
          </div>
        ))}
      </div>

      {/* ERP Sync section */}
      <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">ERP Integration</h2>
          {canApproveDirectly && canSyncErp && !erpSynced && (
            <button
              onClick={handleSyncErp}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              {syncing ? "Syncing..." : erpFailed ? "Retry Sync to ERP" : "Sync to ERP"}
            </button>
          )}
        </div>

        {/* ERP sync details */}
        {order.erpSyncStatus && (
          <div className="space-y-1 text-xs text-[var(--text-tertiary)]">
            <div className="flex justify-between">
              <span>Sync Status</span>
              <span className="font-medium text-[var(--text-primary)]">{order.erpSyncStatus}</span>
            </div>
            {order.erpReferenceNumber && (
              <div className="flex justify-between">
                <span>ERP Reference No.</span>
                <span className="font-medium text-[var(--text-primary)]">{order.erpReferenceNumber}</span>
              </div>
            )}
            {order.erpSyncedAt && (
              <div className="flex justify-between">
                <span>Synced At</span>
                <span className="font-medium text-[var(--text-primary)]">{new Date(order.erpSyncedAt).toLocaleString("en-IN")}</span>
              </div>
            )}
          </div>
        )}

        {/* Toggle for payload/response panel */}
        {(order.erpPayload || order.erpResponse) && (
          <div>
            <button
              onClick={() => setShowErpPanel(!showErpPanel)}
              className="text-xs text-[var(--primary)] hover:underline"
            >
              {showErpPanel ? "Hide" : "Show"} ERP sync details
            </button>
            {showErpPanel && (
              <div className="mt-2 space-y-2">
                {order.erpPayload && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-tertiary)] mb-1">Payload sent to ERP:</p>
                    <pre className="text-xs bg-[var(--surface-1)] border border-[var(--border-subtle)] rounded-lg p-3 overflow-auto max-h-48">{JSON.stringify(JSON.parse(order.erpPayload), null, 2)}</pre>
                  </div>
                )}
                {order.erpResponse && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-tertiary)] mb-1">ERP response:</p>
                    <pre className="text-xs bg-[var(--surface-1)] border border-[var(--border-subtle)] rounded-lg p-3 overflow-auto max-h-48">
                      {(() => { try { return JSON.stringify(JSON.parse(order.erpResponse), null, 2); } catch { return order.erpResponse; } })()}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!order.erpSyncStatus && (
          <p className="text-xs text-[var(--text-tertiary)]">
            {canSyncErp
              ? "No ERP sync attempted yet. Click \"Sync to ERP\" to push this sales order."
              : "Sales order must be in 'Open' or 'Confirmed' status to sync to ERP."}
          </p>
        )}
        {erpSynced && (
          <p className="text-xs text-emerald-600 flex items-center gap-1">
            <CheckCircle2 size={12} /> Already synced to ERP{order.erpReferenceNumber ? ` — Reference: ${order.erpReferenceNumber}` : ""}.
          </p>
        )}
      </div>

      {/* Items table */}
      <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
        <h2 className="text-sm font-semibold mb-2">Items</h2>
        <table className="w-full text-xs">
          <thead className="bg-[var(--surface-3)]"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Description</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Total</th></tr></thead>
          <tbody>
            {items.map((it: any, idx: number) => (
              <tr key={it.id} className="border-t border-[var(--border-subtle)]">
                <td className="p-2">{idx + 1}</td>
                <td className="p-2">{it.description || it.product?.name || "—"}</td>
                <td className="p-2 text-right">{it.quantity} {it.unit || "kgs"}</td>
                <td className="p-2 text-right">{formatCurrency(it.unitPrice)}</td>
                <td className="p-2 text-right">{formatCurrency(it.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageContainer>
  );
}

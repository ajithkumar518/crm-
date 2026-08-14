"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageContainer from "@/components/PageContainer";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import { ChevronLeft } from "lucide-react";

export default function SalesOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { formatCurrency } = useCurrency();
  const toast = useToast();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <PageContainer><CRMSpinner /></PageContainer>;
  if (!order) return <PageContainer><p className="text-rose-500 text-sm">Sales order not found.</p></PageContainer>;

  return (
    <PageContainer className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/sales-orders")} className="p-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--border)]"><ChevronLeft size={18} /></button>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{order.orderNumber}</h1>
        <span className="text-xs px-2 py-1 rounded-full bg-[var(--surface-2)] border border-[var(--border)]">{order.status}</span>
      </div>
      <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-2 text-sm">
        <p><span className="text-[var(--text-tertiary)]">Customer:</span> {order.customer?.name}</p>
        <p><span className="text-[var(--text-tertiary)]">Proforma:</span> {order.proforma?.proformaNumber || "—"}</p>
        <p><span className="text-[var(--text-tertiary)]">Quotation:</span> {order.quotation?.quotationCode || "—"}</p>
        <p><span className="text-[var(--text-tertiary)]">Grand Total:</span> <span className="font-bold text-[var(--primary)]">{formatCurrency(order.grandTotal)}</span></p>
      </div>
      <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
        <h2 className="text-sm font-semibold mb-2">Items</h2>
        <table className="w-full text-xs">
          <thead className="bg-[var(--surface-3)]"><tr><th className="p-2 text-left">#</th><th className="p-2 text-left">Description</th><th className="p-2 text-right">Qty</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">Total</th></tr></thead>
          <tbody>
            {order.items.map((it: any, idx: number) => (
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

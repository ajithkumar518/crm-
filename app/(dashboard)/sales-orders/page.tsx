"use client";

import { useState, useEffect } from "react";
import { useCurrency } from "@/components/CurrencyProvider";
import PageContainer from "@/components/PageContainer";
import { CRMSpinner } from "@/components/CRMSpinner";
import Link from "next/link";

export default function SalesOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { formatCurrency } = useCurrency();

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sales-orders");
      const data = await res.json();
      if (data.success) setOrders(data.data || []);
      else setError(data.message || "Failed to load");
    } catch {
      setError("Failed to load sales orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <PageContainer className="space-y-4">
      <h1 className="text-2xl font-bold text-[var(--text-primary)]">Sales Orders</h1>
      {loading && <CRMSpinner />}
      {error && <p className="text-rose-500 text-sm">{error}</p>}
      {!loading && orders.length === 0 && <p className="text-[var(--text-tertiary)] text-sm">No sales orders yet. Create one from an approved proforma.</p>}
      <div className="space-y-2">
        {orders.map((o: any) => {
          const items = o.items || [];
          const totalItems = items.length;
          const totalQuantity = items.reduce((s: number, it: any) => s + (it.quantity || 0), 0);
          const totalPieces = items.reduce((s: number, it: any) => s + (it.numberOfPieces || 0), 0);
          const customer8020 = o.customer?.customerCategory === "80-20" ? "80/20 Customer" : "Non-80/20 Customer";
          return (
            <Link key={o.id} href={`/sales-orders/${o.id}`} className="block p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--border)]">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">{o.orderNumber}</p>
                  <span className="text-sm font-medium text-[var(--primary)]">{formatCurrency(o.grandTotal)}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1 text-xs text-[var(--text-tertiary)]">
                  <span>{o.customer?.name || "—"}</span>
                  <span>PO Date: {o.orderDate ? new Date(o.orderDate).toLocaleDateString("en-IN") : "—"}</span>
                  <span>{totalItems} items</span>
                  <span>Qty: {totalQuantity.toFixed(3)} kgs</span>
                  <span>Pcs: {totalPieces.toFixed(0)}</span>
                  <span>{customer8020}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </PageContainer>
  );
}

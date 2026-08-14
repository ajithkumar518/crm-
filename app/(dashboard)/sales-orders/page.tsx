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
        {orders.map((o: any) => (
          <Link key={o.id} href={`/sales-orders/${o.id}`} className="flex items-center justify-between p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-subtle)] hover:bg-[var(--border)]">
            <div>
              <p className="text-sm font-semibold text-[var(--text-primary)]">{o.orderNumber}</p>
              <p className="text-xs text-[var(--text-tertiary)]">{o.customer?.customerCode} - {o.customer?.name}</p>
              <p className="text-xs text-[var(--text-tertiary)]">Status: {o.status} · {o._count?.items || 0} items</p>
            </div>
            <span className="text-sm font-medium text-[var(--primary)]">{formatCurrency(o.grandTotal)}</span>
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}

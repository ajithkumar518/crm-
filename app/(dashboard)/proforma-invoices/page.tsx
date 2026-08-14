"use client";

import { useState, useEffect } from "react";
import PageContainer from "@/components/PageContainer";
import { useCurrency } from "@/components/CurrencyProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import Link from "next/link";

export default function ProformaListPage() {
  const [proformas, setProformas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { formatCurrency } = useCurrency();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/proforma-invoices");
      const data = await res.json();
      if (data.success) setProformas(data.data || []);
      else setError(data.message || "Failed to load");
    } catch {
      setError("Failed to load proformas");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <PageContainer className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Proforma Invoices</h1>
      </div>

      {loading && <CRMSpinner />}
      {error && <p className="text-rose-500 text-sm">{error}</p>}

      {!loading && proformas.length === 0 && (
        <p className="text-[var(--text-tertiary)] text-sm">No proforma invoices yet. Generate one from an accepted quotation.</p>
      )}

      <div className="space-y-2">
        {proformas.map((p: any) => (
          <div key={p.id} className="p-3 bg-[var(--surface-2)] rounded-lg border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between">
              <div>
                <Link href={`/proforma-invoices/${p.id}`} className="text-sm font-semibold text-[var(--primary)] hover:underline">{p.proformaNumber}</Link>
                <p className="text-xs text-[var(--text-tertiary)]">{p.customer?.customerCode} - {p.customer?.name}</p>
                <p className="text-xs text-[var(--text-tertiary)]">Status: {p.status} · {p._count?.items || 0} items</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-[var(--primary)]">{formatCurrency(p.grandTotal)}</span>
                <a href={`/api/proforma-invoices/${p.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs px-3 py-1.5 rounded-lg bg-[var(--primary)] text-white hover:opacity-90">
                  PDF
                </a>
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
    </PageContainer>
  );
}

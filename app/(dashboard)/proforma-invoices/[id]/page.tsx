"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageContainer from "@/components/PageContainer";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import { ChevronLeft, Mail, FileText, Package, IndianRupee } from "lucide-react";

export default function ProformaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { formatCurrency } = useCurrency();
  const toast = useToast();

  const [proforma, setProforma] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingSo, setCreatingSo] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/proforma-invoices/${id}`);
      const data = await res.json();
      if (data.success) setProforma(data.data);
      else toast.error(data.message || "Failed to load proforma");
    } catch {
      toast.error("Failed to load proforma");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleStatusChange = async (newStatus: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/proforma-invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Status updated to ${newStatus}`);
        setProforma(data.data);
      } else {
        toast.error(data.message || "Failed to update status");
      }
    } catch {
      toast.error("Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const handleSend = async () => {
    if (!proforma?.customer?.email && !proforma?.contact?.email) {
      toast.error("No email address available for this customer/contact");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`/api/proforma-invoices/${id}/send`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Proforma sent");
        setProforma(data.data);
      } else {
        toast.error(data.message || "Failed to send proforma");
      }
    } catch {
      toast.error("Failed to send proforma");
    } finally {
      setSending(false);
    }
  };

  const handleCreateSalesOrder = async () => {
    setCreatingSo(true);
    try {
      const res = await fetch(`/api/proforma-invoices/${id}/sales-order`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Sales order created");
        router.push(`/sales-orders/${data.data.id}`);
      } else {
        toast.error(data.message || "Failed to create sales order");
      }
    } catch {
      toast.error("Failed to create sales order");
    } finally {
      setCreatingSo(false);
    }
  };

  if (loading) {
    return (
      <PageContainer>
        <CRMSpinner />
      </PageContainer>
    );
  }

  if (!proforma) {
    return (
      <PageContainer>
        <p className="text-sm text-rose-500">Proforma not found.</p>
      </PageContainer>
    );
  }

  const statusOptions = ["Draft", "Sent", "Approved", "PO Received", "Cancelled"];
  const canCreateSo = proforma.status === "Approved" || proforma.status === "PO Received";

  return (
    <PageContainer className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/proforma-invoices")} className="p-2 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--text-secondary)]">
          <ChevronLeft size={18} />
        </button>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{proforma.proformaNumber}</h1>
        <span className="ml-2 text-xs px-2 py-1 rounded-full bg-[var(--surface-2)] text-[var(--text-secondary)] border border-[var(--border)]">{proforma.status}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Proforma Date</p>
                <p className="font-medium text-[var(--text-primary)]">{new Date(proforma.proformaDate).toLocaleDateString("en-IN")}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Valid Until</p>
                <p className="font-medium text-[var(--text-primary)]">{proforma.validityDate ? new Date(proforma.validityDate).toLocaleDateString("en-IN") : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Customer</p>
                <p className="font-medium text-[var(--text-primary)]">{proforma.customer?.name || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Grand Total</p>
                <p className="font-medium text-[var(--primary)]">{formatCurrency(proforma.grandTotal)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Quotation Ref</p>
                <a href={`/quotations/${proforma.quotationId}`} className="text-[var(--primary)] hover:underline">
                  {proforma.quotation?.quotationCode || "View quotation"}
                </a>
              </div>
              <div>
                <p className="text-xs text-[var(--text-tertiary)]">Contact</p>
                <p className="font-medium text-[var(--text-primary)]">{proforma.contact?.name || "—"} {proforma.contact?.phone ? `· ${proforma.contact.phone}` : ""}</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
            <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[var(--surface-3)] text-[var(--text-secondary)]">
                  <tr>
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Description</th>
                    <th className="p-2 text-left">Grade</th>
                    <th className="p-2 text-left">Size</th>
                    <th className="p-2 text-right">Length</th>
                    <th className="p-2 text-right">Pcs</th>
                    <th className="p-2 text-right">Qty</th>
                    <th className="p-2 text-right">Rate</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {proforma.items.map((it: any, idx: number) => (
                    <tr key={it.id} className="border-t border-[var(--border-subtle)]">
                      <td className="p-2 text-[var(--text-primary)]">{idx + 1}</td>
                      <td className="p-2 text-[var(--text-primary)]">{it.description || it.product?.name || "—"}</td>
                      <td className="p-2 text-[var(--text-primary)]">{it.materialGrade || "—"}</td>
                      <td className="p-2 text-[var(--text-primary)]">{it.materialSize || "—"}</td>
                      <td className="p-2 text-right text-[var(--text-primary)]">{it.lengthMm != null ? `${it.lengthMm} mm` : "—"}</td>
                      <td className="p-2 text-right text-[var(--text-primary)]">{it.numberOfPieces != null ? it.numberOfPieces : "—"}</td>
                      <td className="p-2 text-right text-[var(--text-primary)]">{it.quantity} {it.unit || "kgs"}</td>
                      <td className="p-2 text-right text-[var(--text-primary)]">{formatCurrency(it.unitPrice)}</td>
                      <td className="p-2 text-right text-[var(--text-primary)]">{formatCurrency(it.lineTotal)}</td>
                      <td className="p-2 text-[var(--text-primary)]">{it.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {(proforma.paymentTerms || proforma.deliveryTerms || proforma.termsAndConditions) && (
            <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-2 text-sm">
              {proforma.paymentTerms && <p><span className="text-[var(--text-tertiary)]">Payment Terms:</span> {proforma.paymentTerms}</p>}
              {proforma.deliveryTerms && <p><span className="text-[var(--text-tertiary)]">Delivery Terms:</span> {proforma.deliveryTerms}</p>}
              {proforma.termsAndConditions && <p><span className="text-[var(--text-tertiary)]">Terms & Conditions:</span> {proforma.termsAndConditions}</p>}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-4">
            <div>
              <label className="text-xs text-[var(--text-tertiary)] block mb-1">Status</label>
              <select
                value={proforma.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={saving}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm text-[var(--text-primary)]"
              >
                {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <a href={`/api/proforma-invoices/${id}/pdf`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:opacity-90">
                <FileText size={15} /> PDF
              </a>
              <button onClick={handleSend} disabled={sending} className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60">
                <Mail size={15} /> {sending ? "Sending..." : "Send"}
              </button>
              <button onClick={handleCreateSalesOrder} disabled={creatingSo || !canCreateSo} className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">
                <Package size={15} /> {creatingSo ? "Creating..." : "Create Sales Order"}
              </button>
              {!canCreateSo && (
                <p className="text-xs text-[var(--text-tertiary)]">Sales order requires status Approved or PO Received.</p>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-2 text-sm">
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Summary</p>
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Subtotal</span><span className="font-medium text-[var(--text-primary)]">{formatCurrency(proforma.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Tax</span><span className="font-medium text-[var(--text-primary)]">{formatCurrency(proforma.taxAmount)}</span></div>
            {proforma.discountPercent > 0 && (
              <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Discount</span><span className="font-medium text-[var(--text-primary)]">{proforma.discountPercent}%</span></div>
            )}
            <div className="flex justify-between pt-2 border-t border-[var(--border-subtle)]">
              <span className="font-semibold text-[var(--text-primary)]">Grand Total</span>
              <span className="font-bold text-[var(--primary)]">{formatCurrency(proforma.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

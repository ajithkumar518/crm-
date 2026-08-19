"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageContainer from "@/components/PageContainer";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import { ChevronLeft, Mail, FileText, Package, IndianRupee, Trash2 } from "lucide-react";

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
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState<Record<string, any>>({});
  const [savingItems, setSavingItems] = useState(false);

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

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete proforma ${proforma.proformaNumber}? This action cannot be undone.`)) return;
    
    setDeleting(true);
    try {
      const res = await fetch(`/api/proforma-invoices?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Proforma deleted successfully");
        router.push("/proforma-invoices");
      } else {
        toast.error(data.message || "Failed to delete proforma");
      }
    } catch {
      toast.error("Failed to delete proforma");
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = () => {
    const init: Record<string, any> = {};
    for (const it of proforma.items || []) {
      init[it.id] = {
        quantity: String(it.quantity),
        unitPrice: String(it.unitPrice),
        discountPercent: String(it.discountPercent),
        taxPercent: String(it.taxPercent),
        remarks: it.remarks || "",
        cuttingCharge: it.cuttingCharge == null ? "" : String(it.cuttingCharge),
        deliveryDays: it.deliveryDays == null ? "" : String(it.deliveryDays),
      };
    }
    setEditedItems(init);
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditedItems({});
  };

  const saveItems = async () => {
    const itemsPayload = Object.entries(editedItems).map(([itemId, v]) => ({
      id: itemId,
      quantity: parseFloat(v.quantity),
      unitPrice: parseFloat(v.unitPrice),
      discountPercent: parseFloat(v.discountPercent),
      taxPercent: parseFloat(v.taxPercent),
      remarks: v.remarks || null,
      cuttingCharge: v.cuttingCharge === "" ? null : parseFloat(v.cuttingCharge),
      deliveryDays: v.deliveryDays === "" ? null : parseInt(v.deliveryDays),
    }));
    setSavingItems(true);
    try {
      const res = await fetch(`/api/proforma-invoices/${id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsPayload }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Items updated");
        setProforma(data.data);
        setEditMode(false);
        setEditedItems({});
      } else {
        toast.error(data.message || "Failed to update items");
      }
    } catch {
      toast.error("Failed to update items");
    } finally {
      setSavingItems(false);
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
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-[var(--text-primary)]">Items</h2>
              <div className="flex gap-2">
                {!editMode && !proforma.SalesOrder && (
                  <button onClick={startEdit} className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--primary)] text-white hover:opacity-90">Edit Items</button>
                )}
                {editMode && (
                  <>
                    <button onClick={saveItems} disabled={savingItems} className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50">{savingItems ? "Saving..." : "Save"}</button>
                    <button onClick={cancelEdit} disabled={savingItems} className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--surface-3)] text-[var(--text-secondary)] hover:opacity-90">Cancel</button>
                  </>
                )}
              </div>
            </div>
            {proforma.SalesOrder && (
              <p className="text-xs text-amber-600 mb-2">Editing is locked because Sales Order {proforma.SalesOrder.orderNumber} has been created from this proforma.</p>
            )}
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
                    <th className="p-2 text-right">Disc%</th>
                    <th className="p-2 text-right">Tax%</th>
                    <th className="p-2 text-right">Total</th>
                    <th className="p-2 text-left">Remarks</th>
                  </tr>
                </thead>
                <tbody>
                  {(proforma.items || []).map((it: any, idx: number) => (
                    <tr key={it.id} className="border-t border-[var(--border-subtle)]">
                      <td className="p-2 text-[var(--text-primary)]">{idx + 1}</td>
                      <td className="p-2 text-[var(--text-primary)]">{it.description || it.product?.name || "—"}</td>
                      <td className="p-2 text-[var(--text-primary)]">{it.materialGrade || "—"}</td>
                      <td className="p-2 text-[var(--text-primary)]">{it.materialSize || "—"}</td>
                      <td className="p-2 text-right text-[var(--text-primary)]">{it.lengthMm != null ? `${it.lengthMm} mm` : "—"}</td>
                      <td className="p-2 text-right text-[var(--text-primary)]">{it.numberOfPieces != null ? it.numberOfPieces : "—"}</td>
                      {editMode ? (
                        <>
                          <td className="p-1"><input type="number" step="0.001" value={editedItems[it.id]?.quantity ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], quantity: e.target.value } })} className="w-16 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                          <td className="p-1"><input type="number" step="0.01" value={editedItems[it.id]?.unitPrice ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], unitPrice: e.target.value } })} className="w-20 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                          <td className="p-1"><input type="number" step="0.01" value={editedItems[it.id]?.discountPercent ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], discountPercent: e.target.value } })} className="w-14 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                          <td className="p-1"><input type="number" step="0.01" value={editedItems[it.id]?.taxPercent ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], taxPercent: e.target.value } })} className="w-14 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                          <td className="p-2 text-right text-[var(--text-primary)]">{formatCurrency(it.lineTotal)}</td>
                          <td className="p-1"><input type="text" value={editedItems[it.id]?.remarks ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], remarks: e.target.value } })} className="w-28 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                        </>
                      ) : (
                        <>
                          <td className="p-2 text-right text-[var(--text-primary)]">{it.quantity} {it.unit || "kgs"}</td>
                          <td className="p-2 text-right text-[var(--text-primary)]">{formatCurrency(it.unitPrice)}</td>
                          <td className="p-2 text-right text-[var(--text-primary)]">{it.discountPercent}%</td>
                          <td className="p-2 text-right text-[var(--text-primary)]">{it.taxPercent}%</td>
                          <td className="p-2 text-right text-[var(--text-primary)]">{formatCurrency(it.lineTotal)}</td>
                          <td className="p-2 text-[var(--text-primary)]">{it.remarks || "—"}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {proforma.histories && proforma.histories.length > 0 && (
            <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
              <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Edit History</h2>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {(proforma.histories || []).map((h: any) => (
                  <div key={h.id} className="text-xs flex items-center gap-2 text-[var(--text-secondary)]">
                    <span className="text-[var(--text-tertiary)]">{new Date(h.changedAt).toLocaleString("en-IN")}</span>
                    <span className="font-medium text-[var(--text-primary)]">{h.changedBy?.name || "Unknown"}</span>
                    <span>changed</span>
                    <span className="font-mono text-[var(--primary)]">{h.fieldName}</span>
                    <span>from</span>
                    <span className="font-mono">{h.previousValue ?? "null"}</span>
                    <span>to</span>
                    <span className="font-mono">{h.newValue ?? "null"}</span>
                    {h.notes && <span className="text-[var(--text-tertiary)]">({h.notes})</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

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
              <button onClick={handleDelete} disabled={deleting || proforma.SalesOrder} className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-60">
                <Trash2 size={15} /> {deleting ? "Deleting..." : "Delete"}
              </button>
              {!canCreateSo && (
                <p className="text-xs text-[var(--text-tertiary)]">Sales order requires status Approved or PO Received.</p>
              )}
              {proforma.SalesOrder && (
                <p className="text-xs text-[var(--text-tertiary)]">Cannot delete proforma with linked sales order.</p>
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

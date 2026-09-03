"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import PageContainer from "@/components/PageContainer";
import { useCurrency } from "@/components/CurrencyProvider";
import { useToast } from "@/components/ToastProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import { PdfPreviewModal } from "@/components/PdfPreviewModal";
import { ChevronLeft, Mail, FileText, Package, IndianRupee, Trash2 } from "lucide-react";

function Input({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="text-xs text-[var(--text-tertiary)] block mb-1">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)] text-xs"
      />
    </div>
  );
}

function TextArea({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <div>
      <label className="text-xs text-[var(--text-tertiary)] block mb-1">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)] text-xs"
      />
    </div>
  );
}

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
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedItems, setEditedItems] = useState<Record<string, any>>({});
  const [savingItems, setSavingItems] = useState(false);
  const [editedCharges, setEditedCharges] = useState<Record<string, string>>({});

  const CHARGE_FIELDS = [
    { key: "transportCharge", label: "Cutting Charges" },
    { key: "otherCharges", label: "Other Charges" },
    { key: "weighingLoadingCharge", label: "Weighing/Loading Charge" },
    { key: "deliveryCharge", label: "Delivery Charge" },
    { key: "testingCharge", label: "Testing Charge" },
  ];

  const DEFAULT_TERMS = `1. All reports shortage must reach within 3 days and about defective supply if any within 10 days from date of delivery in writing no claim will be acceptable by us thereafter.\n2. Rejection of material will be acceptable only in original shape of out supply (not after machining & cutting hardening)\n3. All disputes are subject to Chennai Jurisdiction only.\n4. Interest @24% will be charged on all over due bills.`;
  const DEFAULT_DECLARATION = `Certified that the particulars given above are true and correct and the amount indicated represents the price actually charged and that there is no flow of additional consideration directly or indirectly from the buyer.`;

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

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const handleDownloadPdf = async () => {
    setPdfPreviewUrl(`/api/proforma-invoices/${id}/pdf`);
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
        // Distinguish email delivery result from workflow status — same pattern as quotation send
        if (data.emailSent === false) {
          toast.error(`Proforma status updated, but email was NOT sent: ${data.emailWarning || "Unknown error"}`);
        } else if (data.emailWarning) {
          toast.success("Proforma sent to customer");
          toast.error(`Email warning: ${data.emailWarning}`);
        } else {
          toast.success(data.message || "Proforma sent to customer");
        }
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

  const [editedHeader, setEditedHeader] = useState<Record<string, any>>({});

  const startEdit = () => {
    const init: Record<string, any> = {};
    for (const it of proforma.items || []) {
      init[it.id] = {
        quantity: String(it.quantity),
        unitPrice: String(it.unitPrice),
        discountPercent: String(it.discountPercent),
        taxPercent: String(it.taxPercent),
        description: it.description || "",
        materialGrade: it.materialGrade || "",
        materialSize: it.materialSize || "",
        lengthMm: it.lengthMm == null ? "" : String(it.lengthMm),
        numberOfPieces: it.numberOfPieces == null ? "" : String(it.numberOfPieces),
        remarks: it.remarks || "",
        cuttingCharge: it.cuttingCharge == null ? "" : String(it.cuttingCharge),
        deliveryDays: it.deliveryDays == null ? "" : String(it.deliveryDays),
      };
    }
    setEditedItems(init);

    const chargeInit: Record<string, string> = {};
    for (const { key } of CHARGE_FIELDS) {
      chargeInit[key] = String(proforma[key] ?? "");
    }
    setEditedCharges(chargeInit);

    setEditedHeader({
      paymentTerms: proforma.paymentTerms || "",
      termsAndConditions: proforma.termsAndConditions || DEFAULT_TERMS,
      irn: proforma.irn || "",
      ackNo: proforma.ackNo || "",
      ewayBillNo: proforma.ewayBillNo || "",
      customerPoNo: proforma.customerPoNo || "",
      despatchThrough: proforma.despatchThrough || "",
      vehicleNo: proforma.vehicleNo || "",
      placeOfSupply: proforma.placeOfSupply || "",
      billName: proforma.billName || proforma.customer?.name || "",
      billAddress: proforma.billAddress || proforma.customer?.billingAddress || "",
      billState: proforma.billState || proforma.customer?.state || "",
      billStateCode: proforma.billStateCode || "",
      billGstNumber: proforma.billGstNumber || proforma.customer?.gstNumber || "",
      billPhone: proforma.billPhone || proforma.customer?.phone || "",
      shipName: proforma.shipName || proforma.customer?.name || "",
      shipAddress: proforma.shipAddress || proforma.customer?.shippingAddress || "",
      shipState: proforma.shipState || proforma.customer?.state || "",
      shipStateCode: proforma.shipStateCode || "",
      shipGstNumber: proforma.shipGstNumber || proforma.customer?.gstNumber || "",
      shipPhone: proforma.shipPhone || proforma.customer?.phone || "",
      preparedBy: proforma.preparedBy || "",
      verifiedBy: proforma.verifiedBy || "",
      declaration: proforma.declaration || DEFAULT_DECLARATION,
      roundedOff: String(proforma.roundedOff ?? 0),
    });
    setEditMode(true);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditedItems({});
    setEditedCharges({});
    setEditedHeader({});
  };

  const saveAll = async () => {
    const itemsPayload = Object.entries(editedItems).map(([itemId, v]) => ({
      id: itemId,
      quantity: parseFloat(v.quantity),
      unitPrice: parseFloat(v.unitPrice),
      discountPercent: parseFloat(v.discountPercent),
      taxPercent: parseFloat(v.taxPercent),
      description: v.description || null,
      materialGrade: v.materialGrade || null,
      materialSize: v.materialSize || null,
      lengthMm: v.lengthMm === "" ? null : parseFloat(v.lengthMm),
      numberOfPieces: v.numberOfPieces === "" ? null : parseFloat(v.numberOfPieces),
      remarks: v.remarks || null,
      cuttingCharge: v.cuttingCharge === "" ? null : parseFloat(v.cuttingCharge),
      deliveryDays: v.deliveryDays === "" ? null : parseInt(v.deliveryDays),
    }));

    const chargePayload: Record<string, number> = {};
    for (const { key } of CHARGE_FIELDS) {
      chargePayload[key] = parseFloat(editedCharges[key]) || 0;
    }

    const headerPayload: Record<string, any> = {};
    for (const key of Object.keys(editedHeader)) {
      if (editedHeader[key] !== "" && editedHeader[key] != null) {
        if (key === "roundedOff") headerPayload[key] = parseFloat(editedHeader[key]) || 0;
        else headerPayload[key] = editedHeader[key];
      } else {
        headerPayload[key] = null;
      }
    }

    setSavingItems(true);
    try {
      const itemRes = await fetch(`/api/proforma-invoices/${id}/items`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: itemsPayload }),
      });
      const itemData = await itemRes.json();
      if (!itemData.success) {
        toast.error(itemData.message || "Failed to update items");
        return;
      }

      const detailRes = await fetch(`/api/proforma-invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...chargePayload, ...headerPayload }),
      });
      const detailData = await detailRes.json();
      if (!detailData.success) {
        toast.error(detailData.message || "Failed to update proforma details");
        return;
      }

      await load();
      toast.success("Proforma updated");
      setEditMode(false);
      setEditedItems({});
      setEditedCharges({});
      setEditedHeader({});
    } catch {
      toast.error("Failed to update proforma");
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

  const charges = proforma;
  const extraCharges = CHARGE_FIELDS.reduce((s, f) => s + ((proforma[f.key] as number) || 0), 0);
  const discountAmount = proforma.subtotal * (proforma.discountPercent || 0) / 100;
  const computedGrandTotal = proforma.subtotal - discountAmount + proforma.taxAmount + extraCharges + (proforma.roundedOff || 0);

  const statusOptions = ["Draft", "Sent", "Approved", "PO Received", "Cancelled"];
  const canCreateSo = proforma.status === "Approved" || proforma.status === "PO Received";
  const canSendProforma = ["Draft", "Sent"].includes(proforma.status);

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
                <p className="font-medium text-[var(--primary)]">{formatCurrency(computedGrandTotal)}</p>
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
                  <button onClick={startEdit} className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--primary)] text-white hover:opacity-90">Edit</button>
                )}
                {editMode && (
                  <>
                    <button onClick={saveAll} disabled={savingItems} className="px-3 py-1 rounded-lg text-xs font-medium bg-[var(--primary)] text-white hover:opacity-90 disabled:opacity-50">{savingItems ? "Saving..." : "Save"}</button>
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
                      {editMode ? (
                        <>
                          <td className="p-1"><input type="text" value={editedItems[it.id]?.description ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], description: e.target.value } })} className="w-32 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                          <td className="p-1"><input type="text" value={editedItems[it.id]?.materialGrade ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], materialGrade: e.target.value } })} className="w-20 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                          <td className="p-1"><input type="text" value={editedItems[it.id]?.materialSize ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], materialSize: e.target.value } })} className="w-20 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                          <td className="p-1"><input type="number" step="0.01" value={editedItems[it.id]?.lengthMm ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], lengthMm: e.target.value } })} className="w-16 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                          <td className="p-1"><input type="number" step="0.01" value={editedItems[it.id]?.numberOfPieces ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], numberOfPieces: e.target.value } })} className="w-16 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                          <td className="p-1"><input type="number" step="0.001" value={editedItems[it.id]?.quantity ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], quantity: e.target.value } })} className="w-16 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                          <td className="p-1"><input type="number" step="0.01" value={editedItems[it.id]?.unitPrice ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], unitPrice: e.target.value } })} className="w-20 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                          <td className="p-1"><input type="number" step="0.01" value={editedItems[it.id]?.discountPercent ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], discountPercent: e.target.value } })} className="w-14 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                          <td className="p-1"><input type="number" step="0.01" value={editedItems[it.id]?.taxPercent ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], taxPercent: e.target.value } })} className="w-14 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                          <td className="p-2 text-right text-[var(--text-primary)]">{formatCurrency(it.lineTotal)}</td>
                          <td className="p-1"><input type="text" value={editedItems[it.id]?.remarks ?? ""} onChange={(e) => setEditedItems({ ...editedItems, [it.id]: { ...editedItems[it.id], remarks: e.target.value } })} className="w-28 px-1 py-0.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)]" /></td>
                        </>
                      ) : (
                        <>
                          <td className="p-2 text-[var(--text-primary)]">{it.description || it.product?.name || "—"}</td>
                          <td className="p-2 text-[var(--text-primary)]">{it.materialGrade || "—"}</td>
                          <td className="p-2 text-[var(--text-primary)]">{it.materialSize || "—"}</td>
                          <td className="p-2 text-right text-[var(--text-primary)]">{it.lengthMm != null ? `${it.lengthMm} mm` : "—"}</td>
                          <td className="p-2 text-right text-[var(--text-primary)]">{it.numberOfPieces != null ? it.numberOfPieces : "—"}</td>
                        </>
                      )}
                      {!editMode && (
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

            {editMode && (
              <div className="mt-4 p-4 rounded-xl bg-[var(--surface-3)] border border-[var(--border)] space-y-3">
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Extra Charges</p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {CHARGE_FIELDS.map((c) => (
                    <div key={c.key}>
                      <label className="text-xs text-[var(--text-tertiary)] block mb-1">{c.label}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editedCharges[c.key] ?? ""}
                        onChange={(e) => setEditedCharges({ ...editedCharges, [c.key]: e.target.value })}
                        className="w-full px-2 py-1.5 rounded border border-[var(--border)] bg-[var(--surface-1)] text-[var(--text-primary)] text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {editMode && (
              <div className="mt-4 p-4 rounded-xl bg-[var(--surface-3)] border border-[var(--border)] space-y-4">
                <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Invoice Details</p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input label="IRN No" value={editedHeader.irn ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, irn: v })} />
                  <Input label="Ack No" value={editedHeader.ackNo ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, ackNo: v })} />
                  <Input label="Eway Bill No" value={editedHeader.ewayBillNo ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, ewayBillNo: v })} />
                  <Input label="Customer PO No" value={editedHeader.customerPoNo ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, customerPoNo: v })} />
                  <Input label="Despatch Through" value={editedHeader.despatchThrough ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, despatchThrough: v })} />
                  <Input label="Vehicle No" value={editedHeader.vehicleNo ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, vehicleNo: v })} />
                  <Input label="Place of Supply" value={editedHeader.placeOfSupply ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, placeOfSupply: v })} />
                  <Input label="Rounded Off" value={editedHeader.roundedOff ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, roundedOff: v })} />
                  <Input label="Prepared By" value={editedHeader.preparedBy ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, preparedBy: v })} />
                  <Input label="Verified By" value={editedHeader.verifiedBy ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, verifiedBy: v })} />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--text-tertiary)] font-semibold">Bill To</p>
                    <Input label="Name" value={editedHeader.billName ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, billName: v })} />
                    <TextArea label="Address" value={editedHeader.billAddress ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, billAddress: v })} />
                    <Input label="State" value={editedHeader.billState ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, billState: v })} />
                    <Input label="State Code" value={editedHeader.billStateCode ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, billStateCode: v })} />
                    <Input label="GST No" value={editedHeader.billGstNumber ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, billGstNumber: v })} />
                    <Input label="Phone" value={editedHeader.billPhone ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, billPhone: v })} />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs text-[var(--text-tertiary)] font-semibold">Ship To</p>
                    <Input label="Name" value={editedHeader.shipName ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, shipName: v })} />
                    <TextArea label="Address" value={editedHeader.shipAddress ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, shipAddress: v })} />
                    <Input label="State" value={editedHeader.shipState ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, shipState: v })} />
                    <Input label="State Code" value={editedHeader.shipStateCode ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, shipStateCode: v })} />
                    <Input label="GST No" value={editedHeader.shipGstNumber ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, shipGstNumber: v })} />
                    <Input label="Phone" value={editedHeader.shipPhone ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, shipPhone: v })} />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <TextArea label="Payment Terms" value={editedHeader.paymentTerms ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, paymentTerms: v })} />
                  <TextArea label="Terms & Conditions" rows={4} value={editedHeader.termsAndConditions ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, termsAndConditions: v })} />
                  <TextArea label="Declaration" rows={3} value={editedHeader.declaration ?? ""} onChange={(v) => setEditedHeader({ ...editedHeader, declaration: v })} />
                </div>
              </div>
            )}
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

          {(proforma.paymentTerms || proforma.deliveryTerms || proforma.termsAndConditions || proforma.declaration) && (
            <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-4 text-sm">
              <div className="space-y-2">
                {proforma.paymentTerms && <p><span className="text-[var(--text-tertiary)] font-medium">Payment Terms:</span> {proforma.paymentTerms}</p>}
                {proforma.deliveryTerms && <p><span className="text-[var(--text-tertiary)] font-medium">Delivery Terms:</span> {proforma.deliveryTerms}</p>}
              </div>
              {proforma.termsAndConditions && (
                <div>
                  <p className="text-[var(--text-tertiary)] font-medium mb-1">Terms & Conditions:</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    {proforma.termsAndConditions.split("\n").filter((line: string) => line.trim() !== "").map((line: string, i: number) => {
                      const cleanLine = line.replace(/^\d+[\.\)]\s*/, "").trim();
                      return <li key={i} className="text-[var(--text-primary)]">{cleanLine}</li>;
                    })}
                  </ol>
                </div>
              )}
              {proforma.declaration && (
                <div>
                  <p className="text-[var(--text-tertiary)] font-medium mb-1">Declaration:</p>
                  <p className="whitespace-pre-wrap text-[var(--text-primary)]">{proforma.declaration}</p>
                </div>
              )}
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
              <button onClick={handleDownloadPdf} disabled={downloadingPdf} className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:opacity-90 disabled:opacity-60">
                <FileText size={15} /> {downloadingPdf ? "Generating..." : "PDF"}
              </button>
              <button onClick={handleSend} disabled={sending || !canSendProforma} title={!canSendProforma ? "Only Draft or Sent proformas can be emailed" : "Send proforma to customer via email"} className="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed">
                <Mail size={15} /> {sending ? "Sending..." : "Send"}
              </button>
              {!canSendProforma && (
                <p className="text-xs text-[var(--text-tertiary)]">Only Draft or Sent proformas can be emailed.</p>
              )}
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

          <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-3 text-sm">
            <p className="text-xs text-[var(--text-tertiary)] uppercase tracking-wide">Summary</p>

            <div className="space-y-2">
              <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Subtotal</span><span className="font-medium text-[var(--text-primary)]">{formatCurrency(proforma.subtotal)}</span></div>
              {proforma.discountPercent > 0 && (
                <>
                  <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Discount ({proforma.discountPercent}%)</span><span className="font-medium text-[var(--text-primary)]">{formatCurrency(discountAmount)}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--text-secondary)]">After Discount</span><span className="font-medium text-[var(--text-primary)]">{formatCurrency(proforma.subtotal - discountAmount)}</span></div>
                </>
              )}
              <div className="flex justify-between"><span className="text-[var(--text-secondary)]">Tax</span><span className="font-medium text-[var(--text-primary)]">{formatCurrency(proforma.taxAmount)}</span></div>
              {CHARGE_FIELDS.map((c) => (
                <div key={c.key} className="flex justify-between">
                  <span className="text-[var(--text-secondary)]">{c.label}</span>
                  <span className="font-medium text-[var(--text-primary)]">{formatCurrency(parseFloat(charges[c.key]) || 0)}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-between pt-2 border-t border-[var(--border-subtle)]">
              <span className="font-semibold text-[var(--text-primary)]">Grand Total</span>
              <span className="font-bold text-[var(--primary)]">{formatCurrency(computedGrandTotal)}</span>
            </div>
          </div>
        </div>
      </div>
      {pdfPreviewUrl && (
        <PdfPreviewModal
          url={pdfPreviewUrl}
          fileName={`${proforma?.proformaNumber || "proforma"}.pdf`}
          title={`Proforma Invoice ${proforma?.proformaNumber || ""}`}
          onClose={() => setPdfPreviewUrl(null)}
        />
      )}
    </PageContainer>
  );
}

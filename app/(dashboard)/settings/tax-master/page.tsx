"use client";

import { useState, useEffect } from "react";
import { PageShell } from "@/components/ui/PageShell";
import { Modal } from "@/components/ui/Modal";
import { FormField, Input, Select } from "@/components/ui/FormField";
import { ModuleGate } from "@/components/ModuleGate";
import { useToast } from "@/components/ToastProvider";
import { useAuth } from "@/components/AuthProvider";
import { useRouter } from "next/navigation";
import {
  getTaxMasterAction,
  createTaxMasterAction,
  updateTaxMasterAction,
  deleteTaxMasterAction,
} from "@/app/actions/taxMaster";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, RefreshCw, Percent } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";

const EMPTY_FORM = {
  taxName: "",
  taxPercent: "",
  hsnCode: "",
  effectiveFrom: new Date().toISOString().split("T")[0],
};

export default function TaxMasterPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const toast = useToast();

  const [taxes, setTaxes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await getTaxMasterAction();
      if (res.success && res.data) setTaxes(res.data);
      else toast.error(res.message || "Failed to load tax rates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user) {
      if (!["Admin", "SalesManager"].includes(user.role)) router.replace("/dashboard");
      else loadData();
    }
  }, [user, authLoading]);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (tax: any) => {
    setEditingId(tax.id);
    setForm({
      taxName: tax.taxName,
      taxPercent: String(tax.taxPercent),
      hsnCode: tax.hsnCode || "",
      effectiveFrom: tax.effectiveFrom ? new Date(tax.effectiveFrom).toISOString().split("T")[0] : new Date().toISOString().split("T")[0],
    });
    setFormErrors({});
    setModalOpen(true);
  };

  const validate = () => {
    const errors: Record<string, string> = {};
    if (!form.taxName.trim()) errors.taxName = "Tax name is required";
    const pct = parseFloat(form.taxPercent);
    if (isNaN(pct) || pct < 0 || pct > 100) errors.taxPercent = "Must be a number 0–100";
    return errors;
  };

  const handleSubmit = async () => {
    const errors = validate();
    if (Object.keys(errors).length) { setFormErrors(errors); return; }

    setSubmitting(true);
    try {
      const payload = {
        taxName: form.taxName,
        taxPercent: parseFloat(form.taxPercent),
        hsnCode: form.hsnCode || undefined,
        effectiveFrom: form.effectiveFrom,
      };
      const res = editingId
        ? await updateTaxMasterAction(editingId, payload)
        : await createTaxMasterAction(payload);

      if (res.success) {
        toast.success(res.message || "Saved");
        setModalOpen(false);
        loadData();
      } else {
        toast.error(res.message || "Failed to save");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggle = async (tax: any) => {
    const res = await updateTaxMasterAction(tax.id, { isActive: !tax.isActive });
    if (res.success) { toast.success(res.message || "Updated"); loadData(); }
    else toast.error(res.message || "Failed");
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete tax rate "${name}"? This cannot be undone.`)) return;
    const res = await deleteTaxMasterAction(id);
    if (res.success) { toast.success(res.message || "Deleted"); loadData(); }
    else toast.error(res.message || "Failed to delete");
  };

  if (authLoading || !user) return null;

  return (
    <ModuleGate variantMin={2}>
    <PageShell
      title="Tax Master"
      subtitle="Manage GST/IGST tax rates used in RFQ costing and quotation line items"
      action={
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white text-xs font-bold rounded-xl shadow-sm transition-colors"
        >
          <Plus size={14} /> Add Tax Rate
        </button>
      }
    >
      <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
          <div>
            <p className="text-sm font-extrabold text-slate-800">Tax Rates</p>
            <p className="text-[11px] text-slate-500 mt-0.5">{taxes.length} rate{taxes.length !== 1 ? "s" : ""} configured</p>
          </div>
          <button onClick={loadData} className="p-2 text-slate-400 hover:text-slate-600 rounded-lg transition-colors" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs">Loading tax rates…</div>
        ) : taxes.length === 0 ? (
          <div className="p-12 text-center">
            <Percent size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-semibold text-slate-500">No tax rates yet</p>
            <p className="text-xs text-slate-400 mt-1">Add GST 5%, 12%, 18%, 28% or custom rates</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Tax Name</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Rate (%)</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">HSN Code</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Effective From</th>
                <th className="px-6 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-500">Status</th>
                <th className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {taxes.map((tax) => (
                <tr key={tax.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-semibold text-slate-800">{tax.taxName}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-[var(--accent-soft)] text-[var(--accent)] text-xs font-bold rounded-full border border-[var(--accent)]/20">
                      {tax.taxPercent}%
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500 text-xs font-mono">{tax.hsnCode || "—"}</td>
                  <td className="px-6 py-4 text-slate-500 text-xs">
                    {new Date(tax.effectiveFrom).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={tax.isActive ? "Active" : "Inactive"} showDot />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleToggle(tax)}
                        title={tax.isActive ? "Deactivate" : "Activate"}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        {tax.isActive
                          ? <ToggleRight size={22} className="text-emerald-500" />
                          : <ToggleLeft size={22} className="text-slate-300" />}
                      </button>
                      <button
                        onClick={() => openEdit(tax)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit"
                      >
                        <Pencil size={13} />
                      </button>
                      {user.role === "Admin" && (
                        <button
                          onClick={() => handleDelete(tax.id, tax.taxName)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Tax Rate" : "Add Tax Rate"}
        subtitle="Used in RFQ costing and quotation line items"
        size="sm"
        footer={
          <>
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-4 py-2 text-xs font-bold text-white bg-[var(--accent)] hover:bg-[var(--accent-hover)] rounded-xl transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving…" : editingId ? "Update" : "Add Rate"}
            </button>
          </>
        }
      >
        <div className="p-6 space-y-4">
          <FormField label="Tax Name" required error={formErrors.taxName}>
            <Input
              placeholder="e.g. GST 18%, IGST 18%"
              value={form.taxName}
              onChange={(e) => setForm({ ...form, taxName: e.target.value })}
            />
          </FormField>

          <FormField label="Tax Percent (%)" required error={formErrors.taxPercent}>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="e.g. 18"
              value={form.taxPercent}
              onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
            />
          </FormField>

          <FormField label="HSN Code" hint="Optional — used for tax classification">
            <Input
              placeholder="e.g. 84839000"
              value={form.hsnCode}
              onChange={(e) => setForm({ ...form, hsnCode: e.target.value })}
            />
          </FormField>

          <FormField label="Effective From">
            <Input
              type="date"
              value={form.effectiveFrom}
              onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
            />
          </FormField>
        </div>
      </Modal>
    </PageShell>
    </ModuleGate>
  );
}

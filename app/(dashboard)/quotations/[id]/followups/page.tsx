"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import PageContainer from "@/components/PageContainer";
import { CRMSpinner } from "@/components/CRMSpinner";
import { FormField, Input, Textarea, Select } from "@/components/ui/FormField";
import { FormSection, FormGrid, FormButton } from "@/components/ui/FormLayout";

const SUKI_QUOTATION_STATUSES = [
  "Draft",
  "Quotation Sent",
  "Follow-up",
  "Revised Rate",
  "Accepted",
  "Rejected",
  "MOQ",
  "Material Not Available",
  "No Stock",
  "Price Pending",
  "Supplier Rate Checking",
  "Converted to Customer",
  "Others",
];

export default function QuotationFollowupsPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [form, setForm] = useState({ nextMeetingDate: "", remarks: "", notes: "", newStatus: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const res = await fetch(`/api/quotations/${id}/followups`);
    const json = await res.json();
    if (json.success) setData(json.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch(`/api/quotations/${id}/followups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ nextMeetingDate: "", remarks: "", notes: "", newStatus: "" });
      load();
    }
    setSaving(false);
  };

  if (loading) return <PageContainer><CRMSpinner /></PageContainer>;
  if (!data) return <PageContainer><p>Failed to load</p></PageContainer>;

  return (
    <PageContainer className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push(`/quotations/${id}`)} className="text-sm text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">← Back</button>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Quotation Follow-up & Response</h1>
      </div>

      <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
        <p className="text-sm text-[var(--text-tertiary)]">Current Status: <span className="font-semibold text-[var(--text-primary)]">{data.quotation.status}</span></p>
      </div>

      <FormSection title="Add Follow-up / Response">
        <form onSubmit={submit} className="space-y-4">
          <FormGrid>
            <FormField label="Next Meeting / Follow-up Date">
              <Input type="date" value={form.nextMeetingDate} onChange={(e) => setForm({ ...form, nextMeetingDate: e.target.value })} />
            </FormField>
            <FormField label="Update Status (optional)">
              <Select value={form.newStatus} onChange={(e) => setForm({ ...form, newStatus: e.target.value })}>
                <option value="">-- No change --</option>
                {SUKI_QUOTATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </FormField>
            <FormField label="Remarks">
              <Input type="text" placeholder="Customer response / reason" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
            </FormField>
            <FormField label="Internal Notes">
              <Textarea placeholder="Private notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
            </FormField>
          </FormGrid>
          <FormButton type="submit" disabled={saving}>{saving ? "Saving..." : "Add Follow-up"}</FormButton>
        </form>
      </FormSection>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Follow-ups</h2>
          <div className="space-y-2">
            {data.followUps.length === 0 && <p className="text-xs text-[var(--text-tertiary)]">No follow-ups recorded.</p>}
            {data.followUps.map((fu: any) => (
              <div key={fu.id} className="p-2 rounded-lg bg-[var(--surface)] text-sm">
                <p className="font-medium text-[var(--text-primary)]">{fu.assignedUser?.name || "—"} · {new Date(fu.nextMeetingDate).toLocaleDateString()}</p>
                {fu.remarks && <p className="text-[var(--text-secondary)]">{fu.remarks}</p>}
                {fu.notes && <p className="text-[var(--text-tertiary)] text-xs">{fu.notes}</p>}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)]">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Status History</h2>
          <div className="space-y-2">
            {data.statusHistory.length === 0 && <p className="text-xs text-[var(--text-tertiary)]">No status changes yet.</p>}
            {data.statusHistory.map((h: any) => (
              <div key={h.id} className="p-2 rounded-lg bg-[var(--surface)] text-sm">
                <p className="font-medium text-[var(--text-primary)]">{h.fromStatus || "—"} → {h.toStatus}</p>
                <p className="text-[var(--text-tertiary)] text-xs">{h.changedBy?.name || "—"} · {new Date(h.changedAt).toLocaleString()}</p>
                {h.notes && <p className="text-[var(--text-secondary)] text-xs">{h.notes}</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

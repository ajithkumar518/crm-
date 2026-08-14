"use client";

import { useState, useEffect } from "react";
import PageContainer from "@/components/PageContainer";
import { useToast } from "@/components/ToastProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import { Plus, Filter, Search } from "lucide-react";

const SUKI_LEAD_SOURCES = [
  "Website",
  "IndiaMART",
  "Justdial",
  "TradeIndia",
  "WhatsApp",
  "Door-to-Door Marketing",
  "Direct Visit",
  "Telephonic Conversation",
];

const LEAD_STATUSES = ["New", "Contacted", "Qualified", "Lost"];

export default function LeadCapturePage() {
  const toast = useToast();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    leadSource: "Website",
    materialInterest: "",
    quantity: "",
    expectedPrice: "",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leads");
      const data = await res.json();
      if (data.success) setLeads(data.data || []);
    } catch {
      // noop — UI works without backend list
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("Lead name is required"); return; }
    try {
      const res = await fetch("/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Lead ${data.data?.leadCode || "registered"} captured`);
        setFormData({ name: "", company: "", email: "", phone: "", city: "", state: "", leadSource: "Website", materialInterest: "", quantity: "", expectedPrice: "", notes: "" });
        load();
      } else {
        toast.error(data.message || "Failed to capture lead");
      }
    } catch {
      toast.error("Failed to capture lead");
    }
  };

  const filtered = leads
    .filter((l: any) => (filter ? l.leadSource === filter : true))
    .filter((l: any) => (search ? l.name?.toLowerCase().includes(search.toLowerCase()) || l.email?.toLowerCase().includes(search.toLowerCase()) : true));

  return (
    <PageContainer className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Lead Capture & Registration</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 p-5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><Plus size={16} /> Register New Lead</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-tertiary)]">Name <span className="text-rose-500">*</span></label>
                <input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="Contact name" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-tertiary)]">Company</label>
                <input value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="Company name" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-tertiary)]">Email</label>
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="Email" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-tertiary)]">Phone</label>
                <input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="Phone" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-tertiary)]">City</label>
                <input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="City" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-tertiary)]">State</label>
                <input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="State" />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)]">Lead Source</label>
              <select value={formData.leadSource} onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm">
                {SUKI_LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)]">Material Interest</label>
              <input value={formData.materialInterest} onChange={(e) => setFormData({ ...formData, materialInterest: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="e.g. EN19 50mm Black Bar" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[var(--text-tertiary)]">Quantity (kgs)</label>
                <input type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="0" />
              </div>
              <div>
                <label className="text-xs text-[var(--text-tertiary)]">Expected Price</label>
                <input type="number" value={formData.expectedPrice} onChange={(e) => setFormData({ ...formData, expectedPrice: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="0" />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)]">Notes</label>
              <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm resize-none" placeholder="Additional details" />
            </div>
            <button type="submit" className="w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:opacity-90">Capture Lead</button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search leads..." className="w-full pl-9 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm">
              <option value="">All Sources</option>
              {SUKI_LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {loading && <CRMSpinner />}

          {!loading && filtered.length === 0 && <p className="text-sm text-[var(--text-tertiary)]">No captured leads found.</p>}

          <div className="space-y-2">
            {filtered.map((l: any) => (
              <div key={l.id} className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)]">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{l.name} <span className="text-xs font-normal text-[var(--text-tertiary)]">({l.leadCode || l.id})</span></p>
                    <p className="text-xs text-[var(--text-tertiary)]">{l.email || "—"} · {l.phone || "—"} · {l.city || "—"}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs px-2 py-1 rounded-full bg-[var(--surface-3)] text-[var(--text-secondary)] border border-[var(--border)]">{l.leadSource || "Website"}</span>
                    <p className="text-xs text-[var(--text-tertiary)] mt-1">{l.status || "New"}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

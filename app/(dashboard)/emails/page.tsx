"use client";

import { useState, useEffect } from "react";
import PageContainer from "@/components/PageContainer";
import { useToast } from "@/components/ToastProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import { Mail, Search } from "lucide-react";

const CLASSIFICATIONS = ["Unclassified", "Enquiry", "General"];

export default function EmailClassificationPage() {
  const toast = useToast();
  const [emails, setEmails] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("Unclassified");
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    from: "",
    subject: "",
    body: "",
    classification: "Enquiry" as "Enquiry" | "General",
    customerId: "",
    name: "",
    phone: "",
    email: "",
    city: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/emails?classification=${filter === "Unclassified" ? "" : filter}`);
      const data = await res.json();
      if (data.success) setEmails(data.data || []);
    } catch {
      setEmails([]);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const res = await fetch("/api/customer-master");
      const data = await res.json();
      if (data.success) setCustomers(data.data || []);
    } catch {
      setCustomers([]);
    }
  };

  useEffect(() => { load(); loadCustomers(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Email classified as ${form.classification}`);
        setForm({ from: "", subject: "", body: "", classification: "Enquiry", customerId: "", name: "", phone: "", email: "", city: "" });
        load();
      } else {
        toast.error(data.message || "Failed to classify email");
      }
    } catch {
      toast.error("Failed to classify email");
    }
  };

  const filtered = emails.filter((em: any) =>
    search
      ? (em.content?.toLowerCase().includes(search.toLowerCase()) ||
         em.customer?.name?.toLowerCase().includes(search.toLowerCase()))
      : true
  );

  const reclassify = async (id: string, status: string) => {
    try {
      const res = await fetch(`/api/emails/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Email reclassified as ${status}`);
        load();
      } else {
        toast.error(data.message || "Failed to reclassify");
      }
    } catch {
      toast.error("Failed to reclassify");
    }
  };

  return (
    <PageContainer className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Email Classification</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 p-5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><Mail size={16} /> Classify Inbound Email</h2>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs text-[var(--text-tertiary)]">From</label>
              <input value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="sender@company.com" />
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)]">Customer (optional)</label>
              <select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm">
                <option value="">-- Select Customer --</option>
                {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.customerCode})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)]">Subject <span className="text-rose-500">*</span></label>
              <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="Enquiry for EN19" required />
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)]">Email Body <span className="text-rose-500">*</span></label>
              <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm resize-none" placeholder="Paste email content..." required />
            </div>
            <div>
              <label className="text-xs text-[var(--text-tertiary)]">Classification</label>
              <select value={form.classification} onChange={(e) => setForm({ ...form, classification: e.target.value as any })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm">
                <option value="Enquiry">Enquiry Mail</option>
                <option value="General">General Mail</option>
              </select>
            </div>

            {form.classification === "Enquiry" && (
              <div className="p-3 rounded-lg bg-[var(--surface-1)] border border-[var(--border-subtle)] space-y-3">
                <p className="text-xs font-semibold text-[var(--text-tertiary)] uppercase">Create lead from this Enquiry (optional)</p>
                <div>
                  <label className="text-xs text-[var(--text-tertiary)]">Contact Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="Name" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="Phone" />
                  <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="Email" />
                </div>
                <div>
                  <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm" placeholder="City" />
                </div>
              </div>
            )}

            <button type="submit" className="w-full px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:opacity-90">Classify & Save</button>
          </form>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search emails..." className="w-full pl-9 rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" />
            </div>
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm">
              {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {loading && <CRMSpinner />}

          {!loading && filtered.length === 0 && <p className="text-sm text-[var(--text-tertiary)]">No emails found.</p>}

          <div className="space-y-2">
            {filtered.map((em: any) => (
              <div key={em.id} className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--border-subtle)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)] truncate">{em.content?.match(/Subject:\s*(.*)/)?.[1] || "—"}</p>
                    <p className="text-xs text-[var(--text-tertiary)] truncate">{em.customer?.name || "—"} · {new Date(em.sentAt).toLocaleString()}</p>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{em.content?.replace(/^\[From:.*\]\nSubject:.*\n\n/, "").slice(0, 120)}...</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className={`text-[10px] px-2 py-1 rounded-full border ${em.status === "Enquiry" ? "bg-amber-50 text-amber-700 border-amber-200" : em.status === "General" ? "bg-sky-50 text-sky-700 border-sky-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
                      {em.status || "Unclassified"}
                    </span>
                    <div className="flex gap-1 mt-2">
                      {em.status !== "Enquiry" && <button onClick={() => reclassify(em.id, "Enquiry")} className="text-[10px] px-2 py-1 rounded bg-amber-100 text-amber-700">Enq</button>}
                      {em.status !== "General" && <button onClick={() => reclassify(em.id, "General")} className="text-[10px] px-2 py-1 rounded bg-sky-100 text-sky-700">Gen</button>}
                    </div>
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

"use client";

import { useState, useEffect } from "react";
import PageContainer from "@/components/PageContainer";
import { useToast } from "@/components/ToastProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import { Server, CheckCircle, XCircle, Save, Send } from "lucide-react";

export default function ErpIntegrationPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [config, setConfig] = useState({
    erp_enabled: false,
    erp_endpoint: "",
    erp_api_key: "",
    erp_company_code: "",
    erp_quotation_sync: false,
    erp_sales_order_sync: false,
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/erp");
      const data = await res.json();
      if (data.success) setConfig({ ...config, ...data.data });
    } catch {
      toast.error("Failed to load ERP settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/erp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
      const data = await res.json();
      if (data.success) toast.success("ERP settings saved");
      else toast.error(data.message || "Failed to save");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!config.erp_endpoint) { toast.error("ERP endpoint is required"); return; }
    setTesting(true);
    setTimeout(() => {
      toast.success("Connection test: simulated OK (no actual ERP call)");
      setTesting(false);
    }, 1000);
  };

  if (loading) return <PageContainer><CRMSpinner /></PageContainer>;

  return (
    <PageContainer className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">ERP Integration</h1>
        <span className={`text-xs px-3 py-1 rounded-full border ${config.erp_enabled ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200"}`}>
          {config.erp_enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="p-5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><Server size={16} /> Configuration</h2>

          <div>
            <label className="text-xs text-[var(--text-tertiary)]">ERP Endpoint URL</label>
            <input value={config.erp_endpoint} onChange={(e) => setConfig({ ...config, erp_endpoint: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="https://erp.suki.example/api/v1" />
          </div>

          <div>
            <label className="text-xs text-[var(--text-tertiary)]">API Key</label>
            <input type="password" value={config.erp_api_key} onChange={(e) => setConfig({ ...config, erp_api_key: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="••••••••" />
          </div>

          <div>
            <label className="text-xs text-[var(--text-tertiary)]">Company Code</label>
            <input value={config.erp_company_code} onChange={(e) => setConfig({ ...config, erp_company_code: e.target.value })} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-1)] px-3 py-2 text-sm" placeholder="SUKI-001" />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="erp_enabled" checked={config.erp_enabled} onChange={(e) => setConfig({ ...config, erp_enabled: e.target.checked })} className="w-4 h-4 rounded border-[var(--border)]" />
            <label htmlFor="erp_enabled" className="text-sm text-[var(--text-primary)]">Enable ERP Integration</label>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleTest} disabled={testing} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60">
              <Send size={15} /> {testing ? "Testing..." : "Test Connection"}
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:opacity-90 disabled:opacity-60">
              <Save size={15} /> {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>

        <div className="p-5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-subtle)] space-y-4">
          <h2 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"><CheckCircle size={16} /> Sync Options</h2>

          <div className="space-y-3">
            <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--surface-1)]">
              <input type="checkbox" checked={config.erp_quotation_sync} onChange={(e) => setConfig({ ...config, erp_quotation_sync: e.target.checked })} className="mt-1 w-4 h-4 rounded border-[var(--border)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Quotation → ERP</p>
                <p className="text-xs text-[var(--text-tertiary)]">Push accepted quotations to ERP as sales quotes.</p>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg border border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--surface-1)]">
              <input type="checkbox" checked={config.erp_sales_order_sync} onChange={(e) => setConfig({ ...config, erp_sales_order_sync: e.target.checked })} className="mt-1 w-4 h-4 rounded border-[var(--border)]" />
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">Sales Order → ERP</p>
                <p className="text-xs text-[var(--text-tertiary)]">Push confirmed sales orders to ERP for fulfillment.</p>
              </div>
            </label>
          </div>

          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            <p className="font-semibold">Note:</p>
            <p>This page provides the ERP configuration UI. The actual HTTP push to your ERP endpoint must be implemented once endpoint and credentials are provided.</p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

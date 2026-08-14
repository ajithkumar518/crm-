"use client";

import { useState, useRef, useCallback } from "react";
import {
  Upload, X, Download, CheckCircle2, AlertTriangle, AlertCircle,
  Loader2, ChevronRight, ChevronLeft,
} from "lucide-react";
import { useToast } from "@/components/ToastProvider";
import { Modal } from "@/components/ui/Modal";

const CUSTOMER_COLUMNS = [
  "Customer Name",
  "GST Number",
  "Contact Person",
  "Mobile Number",
  "Email ID",
  "Address",
  "State",
  "Payment Terms",
  "Credit Days",
  "Marketing Executive",
  "Customer Category",
];

const STEPS = ["Upload File", "Preview & Validate", "Import"];
type Step = 0 | 1 | 2;

interface PreviewRow {
  row: number;
  name: string;
  customerCode: string;
  status: string;
  errors?: string[];
}

interface ImportResponse {
  success: boolean;
  message?: string;
  total: number;
  created: number;
  errors: number;
  details: any[];
  createdRows: { row: number; customerCode: string; name: string }[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImportDone?: () => void;
}

export default function CustomerImportModal({ open, onClose, onImportDone }: Props) {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>(0);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [result, setResult] = useState<ImportResponse | null>(null);

  const validCount = preview.filter((r) => r.status === "Valid").length;
  const invalidCount = preview.filter((r) => r.status !== "Valid").length;

  const runDryRun = useCallback(async (f: File) => {
    setValidating(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/customer-master/import?dryRun=true", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Failed to validate file");
        return;
      }
      setPreview(data.details || []);
      setStep(1);
    } catch (e: any) {
      toast.error("Failed to read file: " + e.message);
    } finally {
      setValidating(false);
    }
  }, [toast]);

  const handleFile = useCallback((f: File) => {
    const name = f.name.toLowerCase();
    if (!name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      toast.error("Only .xlsx and .xls files are supported");
      return;
    }
    setFile(f);
    runDryRun(f);
  }, [toast, runDryRun]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/customer-master/import", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.message || "Import failed");
        return;
      }
      setResult(data);
      setStep(2);
      onImportDone?.();
    } catch (e: any) {
      toast.error("Import error: " + e.message);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    window.location.href = "/api/customer-master/import";
  };

  const downloadErrorReport = () => {
    if (!result) return;
    const rows = [["Row", "Reason"], ...(result.details || []).map((d: any) => [d.row, d.message || (d.errors || []).join("; ")])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customer-import-errors.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setStep(0);
    setFile(null);
    setPreview([]);
    setResult(null);
    setImporting(false);
    setValidating(false);
  };
  const handleClose = () => { reset(); onClose(); };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Customer Master Import"
      subtitle="Upload an Excel file to bulk import customer master data"
      size="xl"
    >
      <div className="px-6 pb-6">
        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6 mt-2">
          {STEPS.map((label, idx) => (
            <div key={idx} className="flex items-center gap-2 flex-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                ${step === idx ? "bg-primary text-primary-foreground" : step > idx ? "bg-green-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {step > idx ? <CheckCircle2 size={14} /> : idx + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${step === idx ? "text-primary" : "text-muted-foreground"}`}>{label}</span>
              {idx < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        {/* ── STEP 0: Upload ── */}
        {step === 0 && (
          <div className="space-y-4">
            <div
              className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer
                ${isDragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              {validating ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="animate-spin text-primary" size={40} />
                  <p className="text-sm text-muted-foreground">Validating file…</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Upload className="text-muted-foreground" size={28} />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">Drag &amp; drop or click to upload</p>
                    <p className="text-sm text-muted-foreground mt-1">Supported: .xlsx, .xls</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-3 rounded-lg border border-border bg-muted/40">
              <p className="text-sm font-medium text-foreground mb-2">Required columns</p>
              <div className="flex flex-wrap gap-1.5">
                {CUSTOMER_COLUMNS.map((c) => (
                  <span key={c} className="px-2 py-0.5 rounded-md bg-background border border-border text-xs text-muted-foreground">
                    {c}
                  </span>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Customer Category accepts <strong>80-20</strong> or <strong>NON-80-20</strong>.
              </p>
            </div>

            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium text-foreground">Need a template?</p>
                <p className="text-xs text-muted-foreground">Download the Excel template with correct headers and an example row</p>
              </div>
              <button onClick={downloadTemplate}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm font-medium hover:bg-background transition-colors">
                <Download size={15} /> Template
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 1: Preview ── */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center dark:bg-blue-950 dark:border-blue-800">
                <p className="text-lg font-bold text-blue-700 dark:text-blue-300">{preview.length}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Total Rows</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center dark:bg-green-950 dark:border-green-800">
                <p className="text-lg font-bold text-green-700 dark:text-green-300">{validCount}</p>
                <p className="text-xs text-green-600 dark:text-green-400">Valid</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center dark:bg-red-950 dark:border-red-800">
                <p className="text-lg font-bold text-red-700 dark:text-red-300">{invalidCount}</p>
                <p className="text-xs text-red-600 dark:text-red-400">Invalid (will skip)</p>
              </div>
            </div>

            <div className="max-h-[320px] overflow-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left w-12">#</th>
                    <th className="px-3 py-2 text-left">Customer Name</th>
                    <th className="px-3 py-2 text-left">Customer Code</th>
                    <th className="px-3 py-2 text-left w-56">Validation</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((r) => (
                    <tr key={r.row} className={r.status !== "Valid" ? "bg-red-50 dark:bg-red-950" : ""}>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.row}</td>
                      <td className="px-3 py-1.5 font-medium truncate max-w-[220px]">{r.name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{r.customerCode}</td>
                      <td className="px-3 py-1.5">
                        {r.status === "Valid"
                          ? <span className="text-green-600 flex items-center gap-1"><CheckCircle2 size={12} /> Valid</span>
                          : <span className="text-red-600 flex items-start gap-1"><AlertCircle size={12} className="shrink-0 mt-0.5" /><span>{(r.errors || []).join("; ")}</span></span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {invalidCount > 0 && (
              <div className="p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-800 flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  {invalidCount} row{invalidCount !== 1 ? "s" : ""} have validation errors and will be skipped during import.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: Result ── */}
        {step === 2 && result && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-center dark:bg-blue-950 dark:border-blue-800">
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{result.total}</p>
                <p className="text-xs text-blue-600 dark:text-blue-400">Total Rows</p>
              </div>
              <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-center dark:bg-green-950 dark:border-green-800">
                <p className="text-2xl font-bold text-green-700 dark:text-green-300">{result.created}</p>
                <p className="text-xs text-green-600 dark:text-green-400">Imported</p>
              </div>
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-center dark:bg-red-950 dark:border-red-800">
                <p className="text-2xl font-bold text-red-700 dark:text-red-300">{result.errors}</p>
                <p className="text-xs text-red-600 dark:text-red-400">Failed</p>
              </div>
            </div>

            {result.created > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800">
                <CheckCircle2 className="text-green-600 shrink-0" size={20} />
                <p className="text-sm text-green-700 dark:text-green-300 font-medium">{result.created} customers imported successfully!</p>
              </div>
            )}

            {result.errors > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-red-600 flex items-center gap-2"><AlertTriangle size={14} /> {result.errors} rows failed</p>
                  <button onClick={downloadErrorReport}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-border hover:bg-muted transition-colors">
                    <Download size={13} /> Error Report
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 p-2 space-y-1">
                  {(result.details || []).slice(0, 20).map((d: any, i: number) => (
                    <p key={i} className="text-xs text-red-700 dark:text-red-300">Row {d.row}: {d.message || (d.errors || []).join("; ")}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Navigation ── */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            {step === 1 && (
              <button onClick={() => { setStep(0); setPreview([]); setFile(null); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                <ChevronLeft size={15} /> Back
              </button>
            )}
            {step === 2 && (
              <button onClick={reset}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
                Import Another File
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={handleClose}
              className="px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
              {step === 2 ? "Close" : "Cancel"}
            </button>

            {step === 1 && (
              <button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                {importing ? <><Loader2 size={15} className="animate-spin" /> Importing…</> : `Import ${validCount} Customer${validCount !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

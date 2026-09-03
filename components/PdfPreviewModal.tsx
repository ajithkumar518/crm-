"use client";

import { useState, useEffect, useCallback } from "react";
import { X, Download, Loader2, ZoomIn, ZoomOut, FileText } from "lucide-react";

interface PdfPreviewModalProps {
  /** API URL that returns the PDF binary (e.g., /api/quotations/123/pdf) */
  url: string | null;
  /** Default filename for download */
  fileName: string;
  /** Title shown in the modal header */
  title?: string;
  /** Called when the modal is closed */
  onClose: () => void;
}

/**
 * Reusable PDF preview modal.
 *
 * Fetches the PDF from the given URL, displays it in an iframe (browser's
 * built-in PDF viewer), and provides a download button. The user can
 * review the PDF before deciding to download it.
 */
export function PdfPreviewModal({ url, fileName, title, onClose }: PdfPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);

  const fetchPdf = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || `Failed to generate PDF (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      setPdfUrl(objectUrl);
    } catch (err: any) {
      setError(err.message || "Failed to load PDF");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetchPdf();
  }, [fetchPdf]);

  // Cleanup object URL on unmount
  useEffect(() => {
    return () => {
      if (pdfUrl) window.URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleDownload = () => {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black/70"
      onClick={onClose}
    >
      {/* Modal container — stop propagation so clicks inside don't close */}
      <div
        className="bg-[var(--surface-1)] flex flex-col w-full h-full max-w-6xl mx-auto my-4 rounded-xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "calc(100vh - 2rem)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--surface-2)] shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText size={18} className="text-[var(--primary)] shrink-0" />
            <span className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {title || fileName}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {/* Zoom controls */}
            {pdfUrl && !loading && !error && (
              <div className="flex items-center gap-1 mr-2">
                <button
                  onClick={() => setZoom((z) => Math.max(50, z - 25))}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-tertiary)]"
                  title="Zoom out"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs text-[var(--text-tertiary)] w-10 text-center">{zoom}%</span>
                <button
                  onClick={() => setZoom((z) => Math.min(200, z + 25))}
                  className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-tertiary)]"
                  title="Zoom in"
                >
                  <ZoomIn size={16} />
                </button>
              </div>
            )}
            {/* Download button */}
            <button
              onClick={handleDownload}
              disabled={!pdfUrl || loading || !!error}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Download PDF"
            >
              <Download size={15} />
              Download
            </button>
            {/* Close button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[var(--surface-3)] text-[var(--text-tertiary)]"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body — PDF iframe or loading/error state */}
        <div className="flex-1 overflow-hidden bg-[var(--surface-1)] relative">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Loader2 size={32} className="animate-spin text-[var(--primary)]" />
              <p className="text-sm text-[var(--text-tertiary)]">Generating PDF...</p>
            </div>
          )}
          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8">
              <div className="text-rose-500 text-sm text-center max-w-md">
                <p className="font-semibold mb-1">Could not generate PDF</p>
                <p className="text-[var(--text-tertiary)]">{error}</p>
              </div>
              <button
                onClick={fetchPdf}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)]"
              >
                Try Again
              </button>
            </div>
          )}
          {pdfUrl && !loading && !error && (
            <iframe
              src={pdfUrl}
              title={fileName}
              className="w-full h-full border-0"
              style={{ zoom: `${zoom}%` }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

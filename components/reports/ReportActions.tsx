"use client";

import { useState } from "react";
import { Download, Calendar } from "lucide-react";
import ScheduleModal from "./ScheduleModal";

interface ReportActionsProps {
  reportId: string;
  filters: Record<string, any>;
}

export default function ReportActions({ reportId, filters }: ReportActionsProps) {
  const [exporting, setExporting] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "excel", filters }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${reportId}-report.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="btn-secondary text-xs flex items-center gap-1.5"
        >
          <Download size={14} />
          {exporting ? "Exporting..." : "Export Excel"}
        </button>
        <button
          onClick={() => setShowSchedule(true)}
          className="btn-secondary text-xs flex items-center gap-1.5"
        >
          <Calendar size={14} />
          Schedule
        </button>
      </div>
      <ScheduleModal reportId={reportId} isOpen={showSchedule} onClose={() => setShowSchedule(false)} />
    </>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useToast } from "@/components/ToastProvider";

interface ScheduleModalProps {
  reportId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ScheduleModal({ reportId, isOpen, onClose }: ScheduleModalProps) {
  const toast = useToast();
  const [frequency, setFrequency] = useState("Weekly");
  const [format, setFormat] = useState("Excel");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/users")
        .then((r) => r.json())
        .then((j) => {
          if (j.success && j.data) setUsers(j.data.filter((u: any) => u.isActive));
          else if (j.users) setUsers(j.users.filter((u: any) => u.isActive));
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSave = async () => {
    if (recipients.length === 0) {
      toast.error("Select at least one recipient");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/reports/${reportId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frequency, format, recipientIds: recipients }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success("Report scheduled successfully");
        onClose();
      } else {
        toast.error(json.message || "Failed to schedule");
      }
    } catch {
      toast.error("Failed to schedule report");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
        <h3 className="text-sm font-bold text-slate-800 mb-4">Schedule Report</h3>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">Frequency</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="input-field text-xs">
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">Delivery Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)} className="input-field text-xs">
              <option value="Excel">Excel</option>
              <option value="PDF">PDF</option>
              <option value="EmailBody">Email Body</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-500 mb-1 block">Recipients</label>
            <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg p-2 space-y-1">
              {users.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-xs py-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recipients.includes(u.id)}
                    onChange={(e) => {
                      if (e.target.checked) setRecipients([...recipients, u.id]);
                      else setRecipients(recipients.filter((r) => r !== u.id));
                    }}
                    className="rounded"
                  />
                  <span className="text-slate-700">{u.name}</span>
                  <span className="text-slate-400 text-[10px]">({u.role})</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 btn-secondary text-xs">Cancel</button>
          <button onClick={handleSave} disabled={loading} className="flex-1 btn-primary text-xs">
            {loading ? "Saving..." : "Save Schedule"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect, useCallback } from "react";
import { cn, formatDateTime } from "@/lib/ui-utils";

interface TimelineEntry {
  id: string;
  source: string;
  type: string;
  icon: string;
  performed_by: string;
  timestamp: string;
  description: string;
  outcome?: string | null;
  full?: any;
}

interface TimelineComponentProps {
  relatedType: string;
  relatedId: string;
  className?: string;
  onQuickLog?: (activityType: string) => void;
}

const TYPE_BADGE_COLORS: Record<string, string> = {
  Call: "bg-blue-100 text-blue-700 border-blue-200",
  Email: "bg-purple-100 text-purple-700 border-purple-200",
  WhatsApp: "bg-green-100 text-green-700 border-green-200",
  Meeting: "bg-orange-100 text-orange-700 border-orange-200",
  Note: "bg-slate-100 text-slate-700 border-slate-200",
  FollowUp: "bg-amber-100 text-amber-700 border-amber-200",
  Task: "bg-teal-100 text-teal-700 border-teal-200",
  Reassignment: "bg-indigo-100 text-indigo-700 border-indigo-200",
};

const QUICK_LOG_ICONS = [
  { type: "Call", icon: "📞", label: "Log Call" },
  { type: "Email", icon: "📧", label: "Log Email" },
  { type: "WhatsApp", icon: "💬", label: "Log WhatsApp" },
  { type: "Meeting", icon: "🤝", label: "Log Meeting" },
  { type: "Note", icon: "📝", label: "Add Note" },
];

function getRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? "s" : ""} ago`;
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? "s" : ""} ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 7) return `${diffDay} days ago`;
  return formatDateTime(timestamp);
}

function getDateGroup(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const entryDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (entryDate.getTime() === todayStart.getTime()) return "Today";
  if (entryDate.getTime() === yesterdayStart.getTime()) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function TimelineComponent({ relatedType, relatedId, className, onQuickLog }: TimelineComponentProps) {
  const [entries, setEntries] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchTimeline = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/activities/timeline/${relatedType}/${relatedId}`);
      const data = await res.json();
      if (data.success) {
        setEntries(data.data || []);
      } else {
        setError(data.message || "Failed to load timeline");
      }
    } catch {
      setError("Failed to load timeline");
    } finally {
      setLoading(false);
    }
  }, [relatedType, relatedId]);

  useEffect(() => {
    fetchTimeline();
  }, [fetchTimeline]);

  // Group entries by date
  const grouped: Record<string, TimelineEntry[]> = {};
  for (const entry of entries) {
    const group = getDateGroup(entry.timestamp);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push(entry);
  }

  return (
    <div className={cn("flex flex-col gap-0", className)}>
      {/* Quick-log bar */}
      <div className="flex items-center gap-2 pb-4 border-b border-slate-100 mb-4">
        <span className="text-xs font-medium text-slate-500 mr-1">Quick Log:</span>
        {QUICK_LOG_ICONS.map((q) => (
          <button
            key={q.type}
            onClick={() => onQuickLog?.(q.type)}
            title={q.label}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors text-sm"
          >
            <span className="text-base">{q.icon}</span>
            <span className="text-xs font-medium text-slate-600">{q.type}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8 text-slate-400 text-sm">
          <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading timeline...
        </div>
      )}

      {error && (
        <div className="py-8 text-center text-sm text-rose-500">{error}</div>
      )}

      {!loading && !error && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-sm">
          <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          No activity yet. Use the quick-log bar above to add one.
        </div>
      )}

      {!loading && !error && entries.length > 0 && (
        <div className="flex flex-col gap-6">
          {Object.entries(grouped).map(([dateGroup, groupEntries]) => (
            <div key={dateGroup}>
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3 sticky top-0 bg-white py-1 z-10">
                {dateGroup}
              </div>
              <div className="flex flex-col gap-0">
                {groupEntries.map((entry, idx) => {
                  const isExpanded = expandedId === entry.id;
                  const badgeColor = TYPE_BADGE_COLORS[entry.type] || "bg-slate-100 text-slate-700 border-slate-200";
                  return (
                    <div key={entry.id} className="flex gap-3 relative">
                      {/* Line */}
                      <div className="flex flex-col items-center shrink-0">
                        <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-sm shrink-0">
                          {entry.icon}
                        </div>
                        {idx < groupEntries.length - 1 && (
                          <div className="w-px flex-1 bg-slate-100 mt-1" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="pb-5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full border", badgeColor)}>
                            {entry.type}
                          </span>
                          <span className="text-sm font-semibold text-slate-800">{entry.performed_by}</span>
                          <span className="text-[11px] text-slate-400">· {getRelativeTime(entry.timestamp)}</span>
                        </div>
                        <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                          {entry.description?.substring(0, 100)}
                          {entry.description && entry.description.length > 100 && !isExpanded && "..."}
                        </p>
                        {entry.outcome && (
                          <p className="text-xs text-slate-400 mt-0.5">Outcome: {entry.outcome}</p>
                        )}
                        {isExpanded && entry.full && (
                          <div className="mt-2 p-3 bg-slate-50 rounded-lg text-xs text-slate-600 space-y-1">
                            {entry.full.content && entry.full.content !== entry.description && (
                              <p><span className="font-medium">Details:</span> {entry.full.content}</p>
                            )}
                            {entry.full.direction && <p><span className="font-medium">Direction:</span> {entry.full.direction}</p>}
                            {entry.full.duration != null && <p><span className="font-medium">Duration:</span> {entry.full.duration} min</p>}
                            {entry.full.location && <p><span className="font-medium">Location:</span> {entry.full.location}</p>}
                            {entry.full.mode && <p><span className="font-medium">Mode:</span> {entry.full.mode}</p>}
                            {entry.full.agenda && <p><span className="font-medium">Agenda:</span> {entry.full.agenda}</p>}
                            {entry.full.attendees && entry.full.attendees.length > 0 && (
                              <p><span className="font-medium">Attendees:</span> {entry.full.attendees.map((a: any) => a.contact?.name || a.user?.name).filter(Boolean).join(", ")}</p>
                            )}
                            {entry.full.completionNotes && <p><span className="font-medium">Completion Notes:</span> {entry.full.completionNotes}</p>}
                            {entry.full.priority && <p><span className="font-medium">Priority:</span> {entry.full.priority}</p>}
                          </div>
                        )}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                          className="text-[11px] text-slate-400 hover:text-slate-600 mt-1 font-medium"
                        >
                          {isExpanded ? "Show less" : "Show more"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

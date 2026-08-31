"use client";

import React, { ReactNode } from "react";
import { RefreshCw } from "lucide-react";

/**
 * ReportFilterLayout — Enterprise-grade, standardized filter panel for all report pages.
 *
 * Structure (top to bottom):
 *   1. Header row (title + optional refresh)
 *   2. Stages/Status chips — FULL WIDTH, wraps cleanly (optional)
 *   3. Filters grid — responsive, uniform box sizes
 *   4. Actions row — Apply + Reset, aligned left
 *
 * Props:
 *   - title:        panel heading text (e.g. "Filter Opportunities")
 *   - stages:       optional array of stage/status strings for chip row
 *   - activeStages: optional array of currently active stage strings
 *   - onToggleStage: optional handler when a stage chip is clicked
 *   - stageLabel:   optional label for the stages row (default: "Stages")
 *   - filters:      array of ReactNode — each rendered as a uniform filter box
 *   - onApply:      apply filters callback
 *   - onReset:      reset filters callback
 *   - onRefresh:    optional refresh callback (shows refresh icon in header)
 *   - applyLabel:   optional label for apply button (default: "Apply Filters")
 *   - resetLabel:   optional label for reset button (default: "Reset")
 *   - children:     optional extra content rendered between filters and actions
 */
export interface ReportFilterLayoutProps {
  title: string;
  stages?: string[];
  activeStages?: string[];
  onToggleStage?: (stage: string) => void;
  stageLabel?: string;
  filters: ReactNode[];
  onApply: () => void;
  onReset: () => void;
  onRefresh?: () => void;
  applyLabel?: string;
  resetLabel?: string;
  children?: ReactNode;
}

export function ReportFilterLayout({
  title,
  stages,
  activeStages = [],
  onToggleStage,
  stageLabel = "Stages",
  filters,
  onApply,
  onReset,
  onRefresh,
  applyLabel = "Apply Filters",
  resetLabel = "Reset",
  children,
}: ReportFilterLayoutProps) {
  const hasStages = stages && stages.length > 0;

  return (
    <div className="crm-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h4>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
        )}
      </div>

      {/* Row 1: Stages / Status — FULL WIDTH, wraps cleanly */}
      {hasStages && (
        <div className="pb-4 border-b border-slate-100">
          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2.5">
            {stageLabel}
          </label>
          <div className="flex flex-wrap gap-2 w-full">
            {stages!.map((stage) => {
              const isActive = activeStages.includes(stage);
              return (
                <button
                  key={stage}
                  onClick={() => onToggleStage?.(stage)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {stage}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Row 2: Filters — responsive grid, uniform box sizes */}
      {filters.length > 0 && (
        <div
          className="grid gap-4 w-full"
          style={{
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {React.Children.toArray(filters).map((filterNode, idx) => (
            <div key={`filter-wrapper-${idx}`} className="min-w-0">
              {filterNode}
            </div>
          ))}
        </div>
      )}

      {/* Optional extra content (e.g. search bar) */}
      {children}

      {/* Row 3: Actions — aligned left, consistent spacing */}
      <div className="flex items-center gap-3 pt-1">
        <button
          onClick={onApply}
          className="h-9 px-5 rounded-xl text-xs font-bold text-white bg-[var(--accent)] hover:opacity-90 cursor-pointer transition-opacity"
        >
          {applyLabel}
        </button>
        <button
          onClick={onReset}
          className="h-9 px-4 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 cursor-pointer transition-colors"
        >
          {resetLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * FilterField — helper sub-component for consistent label + input styling.
 * Wraps a label and child input/select in a uniform box.
 */
export interface FilterFieldProps {
  label: string;
  children: ReactNode;
}

export function FilterField({ label, children }: FilterFieldProps) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * filterInputClass — shared className for all filter inputs/selects to ensure uniform height & style.
 */
export const filterInputClass =
  "w-full h-9 px-3 rounded-lg border border-slate-200 text-xs font-semibold bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/20 cursor-pointer";

"use client";

interface FollowUpDetailModalProps {
  followUp: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function FollowUpDetailModal({ followUp, isOpen, onClose }: FollowUpDetailModalProps) {
  if (!isOpen || !followUp) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onClick={onClose}>
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose}></div>
        <div
          className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Follow-Up Details</h3>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Date & Time</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">
                  {followUp.nextMeetingDate ? new Date(followUp.nextMeetingDate).toLocaleString() : "—"}
                </span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Status</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{followUp.status}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Type</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{followUp.type || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Priority</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{followUp.priority || "—"}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-0.5">Assigned To</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{followUp.assignedUser?.name || "—"}</span>
              </div>
              {followUp.completedBy && (
                <div>
                  <span className="text-slate-400 font-bold uppercase block mb-0.5">Completed By</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{followUp.completedBy?.name || "—"}</span>
                </div>
              )}
            </div>

            <div>
              <span className="text-slate-400 font-bold uppercase block mb-1 text-xs">Scheduled Notes</span>
              <p className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                {followUp.notes || "No scheduled notes."}
              </p>
            </div>

            {followUp.callNotes && (
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-1 text-xs">Call Notes / Completion Notes</span>
                <p className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  {followUp.callNotes}
                </p>
              </div>
            )}

            {followUp.quotation && (
              <div>
                <span className="text-slate-400 font-bold uppercase block mb-1 text-xs">Linked Quotation</span>
                <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs">
                  {followUp.quotation.quotationCode}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

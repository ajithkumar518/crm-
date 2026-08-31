"use client";

import { useState, useEffect } from "react";
import { createFollowUpAction } from "@/app/actions/followUps";
import { useToast } from "@/components/ToastProvider";
import { X } from "lucide-react";

interface QuotationFollowUpDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  quotation: {
    id: string;
    quotationCode: string;
    customerId?: string | null;
    customer?: { name?: string | null } | null;
  };
  user: { id: string; role: string } | null;
  users: { id: string; name: string }[];
}

function formatDateForInput(d: Date) {
  return d.toISOString().substring(0, 10);
}

function formatTimeForInput(d: Date) {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export default function QuotationFollowUpDrawer({
  isOpen,
  onClose,
  onSuccess,
  quotation,
  user,
  users,
}: QuotationFollowUpDrawerProps) {
  const toast = useToast();
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [followUpType, setFollowUpType] = useState("Call");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [assignedToId, setAssignedToId] = useState("");
  const [discussionNotes, setDiscussionNotes] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [nextFollowUpTime, setNextFollowUpTime] = useState("");
  const [nextFollowUpType, setNextFollowUpType] = useState("Meeting");
  const [outcome, setOutcome] = useState("");

  useEffect(() => {
    if (isOpen) {
      // Reset all fields to blank defaults so no previous values appear
      setFollowUpDate("");
      setFollowUpTime("");
      setFollowUpType("Call");
      setPriority("Medium");
      setAssignedToId(user?.id || "");
      setDiscussionNotes("");
      setNextFollowUpDate("");
      setNextFollowUpTime("");
      setNextFollowUpType("Meeting");
      setOutcome("");
      setErrorMsg("");
    }
  }, [isOpen, user?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");

    if (!followUpDate || !followUpTime) {
      setErrorMsg("Date and time are required");
      setFormLoading(false);
      return;
    }

    const combinedDateTime = new Date(`${followUpDate}T${followUpTime}`);

    try {
      const assignedUserId = user?.role === "SalesExecutive" ? user.id : (assignedToId || user?.id);
      const res = await createFollowUpAction({
        quotationId: quotation.id,
        customerId: quotation.customerId,
        quotationCode: quotation.quotationCode,
        nextMeetingDate: combinedDateTime.toISOString(),
        remarks: discussionNotes,
        notes: discussionNotes,
        priority,
        sourceType: "MANUAL",
        assignedUserId,
        autoCreated: false,
        type: followUpType as any,
      });

      if (res.success) {
        if (nextFollowUpDate && nextFollowUpTime) {
          const nextDateTime = new Date(`${nextFollowUpDate}T${nextFollowUpTime}`);
          await createFollowUpAction({
            quotationId: quotation.id,
            customerId: quotation.customerId,
            quotationCode: quotation.quotationCode,
            nextMeetingDate: nextDateTime.toISOString(),
            remarks: `Next scheduled meeting details. Type: ${nextFollowUpType}`,
            notes: `Next scheduled meeting details. Type: ${nextFollowUpType}`,
            priority: "Medium",
            sourceType: "MANUAL",
            assignedUserId,
            autoCreated: false,
            type: nextFollowUpType as any,
          });
        }

        toast.success("Follow-up scheduled successfully");
        onClose();
        onSuccess?.();
      } else {
        setErrorMsg(res.message || "Failed to schedule follow-up");
      }
    } catch {
      setErrorMsg("An error occurred during submission");
    } finally {
      setFormLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={onClose}></div>
      <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
        <div className="w-screen max-w-[520px] bg-white dark:bg-slate-900 shadow-2xl flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-[#FAF6F3] dark:bg-slate-900">
            <div>
              <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100">Add Quotation Follow Up</h2>
              <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                Linked to {quotation.quotationCode}
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer">
              <X size={20} />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto flex flex-col min-h-0">
            <div className="p-6 space-y-6">
              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-xs font-bold text-red-700 text-center">{errorMsg}</div>
              )}

              {/* Quotation context banner */}
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1">Linked Quotation</p>
                <p className="text-sm font-bold text-blue-900 dark:text-blue-200">{quotation.quotationCode}</p>
                {quotation.customer?.name && (
                  <p className="text-[10px] text-blue-600 dark:text-blue-300 mt-0.5">{quotation.customer.name}</p>
                )}
              </div>

              {/* Lead / Quotation Information */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-[#B3592D] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  Lead Information
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Entity Type</label>
                    <select disabled className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-250 text-xs font-bold text-slate-500 cursor-not-allowed">
                      <option>Account</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Account Name <span className="text-red-500">*</span></label>
                    <select disabled className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-250 text-xs font-bold text-slate-500 cursor-not-allowed">
                      <option>{quotation.customer?.name || "—"}</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Company Name</label>
                  <input type="text" disabled className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-250 text-xs font-semibold text-slate-700 dark:text-slate-200" value={quotation.quotationCode} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Phone No</label>
                    <input type="text" disabled className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-250 text-xs font-semibold text-slate-700 dark:text-slate-200" placeholder="" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Email ID</label>
                    <input type="text" disabled className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-250 text-xs font-semibold text-slate-700 dark:text-slate-200" placeholder="" />
                  </div>
                </div>
              </div>

              {/* Follow Up Details */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-[#B3592D] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  Follow Up Details
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Follow-up Date <span className="text-red-500">*</span></label>
                    <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Follow-up Time <span className="text-red-500">*</span></label>
                    <input type="time" value={followUpTime} onChange={(e) => setFollowUpTime(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-100" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Follow-up Type</label>
                    <select value={followUpType} onChange={(e) => setFollowUpType(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-100 cursor-pointer">
                      <option value="Call">Call</option>
                      <option value="Meeting">Meeting</option>
                      <option value="Email">Email</option>
                      <option value="WhatsApp">WhatsApp</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Priority</label>
                    <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-100 cursor-pointer">
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {user?.role !== "SalesExecutive" && (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assigned To</label>
                      <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-100 cursor-pointer">
                        <option value="">Select Assignee...</option>
                        {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
                      </select>
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                    <select disabled className="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-250 text-xs font-bold text-slate-500 cursor-not-allowed">
                      <option>Pending</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Discussion Notes</label>
                  <textarea rows={3} value={discussionNotes} onChange={(e) => setDiscussionNotes(e.target.value)} placeholder="Customer shown interested in the product..." className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-100 resize-none" />
                </div>
              </div>

              {/* Next Follow Up */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-[#B3592D] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  Next Follow Up
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Next Follow-up Date</label>
                    <input type="date" value={nextFollowUpDate} onChange={(e) => setNextFollowUpDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-100" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Next Follow-up Time</label>
                    <input type="time" value={nextFollowUpTime} onChange={(e) => setNextFollowUpTime(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-100" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Next Follow-up Type</label>
                  <select value={nextFollowUpType} onChange={(e) => setNextFollowUpType(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-100 cursor-pointer">
                    <option value="Call">Call</option>
                    <option value="Meeting">Meeting</option>
                    <option value="Email">Email</option>
                    <option value="WhatsApp">WhatsApp</option>
                  </select>
                </div>
              </div>

              {/* Outcome */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-[#B3592D] uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 pb-1.5">
                  Outcome
                </h3>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Outcome</label>
                  <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-250 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-100 cursor-pointer">
                    <option value="">Select outcome...</option>
                    <option value="Interested">Interested</option>
                    <option value="Not Interested">Not Interested</option>
                    <option value="No Response">No Response</option>
                    <option value="Callback Requested">Callback Requested</option>
                    <option value="Negotiation">Negotiation</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-[#FAF6F3] dark:bg-slate-900 flex justify-end gap-3 shrink-0">
              <button type="button" onClick={onClose} className="px-5 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">Cancel</button>
              <button type="submit" disabled={formLoading} className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer disabled:opacity-50">
                {formLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

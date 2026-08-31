"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  getQuotationFollowUpsAction,
  createFollowUpAction,
  cancelFollowUpAction,
  updateFollowUpAction,
} from "@/app/actions/followUps";
import { getUsersAction } from "@/app/actions/users";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { StatusBadge, PriorityBadge } from "@/components/ui/StatusBadge";
import { isQuotationFollowupAllowed } from "@/lib/feature-allowlist";
import FollowUpDetailModal from "./FollowUpDetailModal";
import {
  Plus,
  X,
  Pencil,
  CheckCircle,
  Ban,
  CalendarClock,
  ExternalLink,
} from "lucide-react";

function formatDate(dateString: string | Date | null) {
  if (!dateString) return "—";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "—";
  const month = d.toLocaleString("default", { month: "short" });
  const day = d.getDate();
  const year = d.getFullYear();
  return `${month} ${day},${year}`;
}

const AVATAR_COLORS = [
  "bg-[var(--primary)] text-white",
  "bg-amber-500 text-white",
  "bg-purple-600 text-white",
  "bg-teal-600 text-white",
  "bg-pink-600 text-white",
  "bg-indigo-600 text-white",
];

interface QuotationFollowUpsTabProps {
  quotationId: string;
  quotationCode: string;
}

/**
 * Embedded follow-ups tab for the quotation detail page.
 * Shows a compact list of follow-ups linked to this quotation,
 * with inline add/edit/cancel/complete actions.
 * Only visible to users in the quotation-followup allow-list.
 */
export default function QuotationFollowUpsTab({ quotationId, quotationCode }: QuotationFollowUpsTabProps) {
  const router = useRouter();
  const { user } = useAuth();
  const toast = useToast();

  const [followUps, setFollowUps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFollowUp, setSelectedFollowUp] = useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"add" | "edit">("add");
  const [editingFollowUpId, setEditingFollowUpId] = useState<string | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form fields
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [followUpType, setFollowUpType] = useState("Call");
  const [priority, setPriority] = useState<"Low" | "Medium" | "High">("Medium");
  const [assignedToId, setAssignedToId] = useState("");
  const [status, setStatus] = useState("Pending");
  const [discussionNotes, setDiscussionNotes] = useState("");

  const isFeatureUser = isQuotationFollowupAllowed(user?.email);

  const loadData = useCallback(async () => {
    if (!quotationId) return;
    setLoading(true);
    try {
      const [fuRes, usersRes] = await Promise.all([
        getQuotationFollowUpsAction(quotationId),
        getUsersAction(),
      ]);
      if (fuRes.success && fuRes.data) {
        setFollowUps(fuRes.data);
      }
      if (usersRes?.success && usersRes.data) {
        setUsers(usersRes.data.filter((u: any) => u.isActive && (u.role === "SalesExecutive" || u.role === "SalesManager")));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    if (isFeatureUser) {
      loadData();
    }
  }, [isFeatureUser, loadData]);

  const handleOpenAddDrawer = () => {
    setDrawerMode("add");
    setEditingFollowUpId(null);
    setFollowUpDate("");
    setFollowUpTime("");
    setFollowUpType("Call");
    setPriority("Medium");
    setAssignedToId(user?.id || "");
    setStatus("Pending");
    setDiscussionNotes("");
    setErrorMsg("");
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (f: any) => {
    setDrawerMode("edit");
    setEditingFollowUpId(f.id);
    if (f.nextMeetingDate) {
      const d = new Date(f.nextMeetingDate);
      setFollowUpDate(d.toISOString().substring(0, 10));
      const hours = String(d.getHours()).padStart(2, "0");
      const minutes = String(d.getMinutes()).padStart(2, "0");
      setFollowUpTime(`${hours}:${minutes}`);
    }
    setFollowUpType(f.type || "Call");
    setPriority(f.priority || "Medium");
    setAssignedToId(f.assignedUserId);
    setStatus(f.status);
    setDiscussionNotes(f.remarks || f.notes || "");
    setErrorMsg("");
    setIsDrawerOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
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
      if (drawerMode === "add") {
        const res = await createFollowUpAction({
          quotationId,
          nextMeetingDate: combinedDateTime,
          remarks: discussionNotes,
          notes: discussionNotes,
          priority,
          sourceType: "MANUAL",
          assignedUserId: user?.role === "SalesExecutive" ? user.id : assignedToId,
          autoCreated: false,
          type: followUpType as any,
        });
        if (res.success) {
          toast.success("Follow-up scheduled successfully");
          setIsDrawerOpen(false);
          loadData();
        } else {
          setErrorMsg(res.message || "Failed to create follow-up");
        }
      } else {
        if (!editingFollowUpId) return;
        const res = await updateFollowUpAction(editingFollowUpId, {
          nextMeetingDate: combinedDateTime,
          remarks: discussionNotes,
          notes: discussionNotes,
          priority,
          status,
          assignedUserId: user?.role === "SalesExecutive" ? user.id : assignedToId,
        });
        if (res.success) {
          toast.success("Follow-up updated successfully");
          setIsDrawerOpen(false);
          loadData();
        } else {
          setErrorMsg(res.message || "Failed to update follow-up");
        }
      }
    } catch {
      setErrorMsg("An error occurred during submission");
    } finally {
      setFormLoading(false);
    }
  };

  const handleCancelClick = async (f: any) => {
    if (!confirm(`Are you sure you want to cancel this follow-up?`)) return;
    try {
      const res = await cancelFollowUpAction({ id: f.id, notes: "Cancelled from quotation detail" });
      if (res.success) {
        toast.success("Follow-up cancelled successfully");
        loadData();
      } else {
        toast.error(res.message || "Failed to cancel follow-up");
      }
    } catch {
      toast.error("Failed to cancel follow-up");
    }
  };

  const handleComplete = (f: any) => {
    const params = new URLSearchParams({ followUpId: f.id, returnTo: `/quotations/${quotationId}` });
    if (f.leadId) params.set("leadId", f.leadId);
    if (f.customerId) params.set("customerId", f.customerId);
    router.push(`/activities/new?${params.toString()}`);
  };

  if (!isFeatureUser) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-8 text-center">
        <CalendarClock size={32} className="mx-auto text-slate-300 mb-2" />
        <p className="text-sm text-slate-400">Follow-ups tab is not available for your account.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Follow-Ups</h2>
            <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold">{followUps.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push(`/follow-up/quotation/${quotationId}`)}
              className="flex items-center gap-1 text-xs font-bold text-[var(--primary)] hover:underline cursor-pointer"
              title="Open full follow-ups page"
            >
              <ExternalLink size={13} /> Full View
            </button>
            <button
              onClick={handleOpenAddDrawer}
              className="flex items-center gap-1 text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] px-3 py-1.5 rounded-lg cursor-pointer"
            >
              <Plus size={14} /> Add
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr className="crm-tr border-b border-slate-100">
                <th className="crm-th text-center">#</th>
                <th className="crm-th">Assigned To</th>
                <th className="crm-th">Date</th>
                <th className="crm-th">Type</th>
                <th className="crm-th">Status</th>
                <th className="crm-th">Priority</th>
                <th className="crm-th">Notes</th>
                <th className="crm-th">Call Notes</th>
                <th className="crm-th text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-8 text-slate-400 text-xs">Loading...</td></tr>
              ) : followUps.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-10 text-slate-400 text-xs">
                    No follow-ups for this quotation yet. Click "Add" to create one.
                  </td>
                </tr>
              ) : (
                followUps.map((f, index) => {
                  const isCompleted = f.status === "Completed";
                  const isOverdue = (f.badgeStatus === "OVERDUE" || f.status === "Overdue") && !isCompleted;
                  const isCancelled = f.status === "Cancelled";
                  const displayName = f.assignedUser?.name || "System";
                  const nameParts = displayName.split(" ");
                  const initials = nameParts.map((n: string) => n[0]).join("").substring(0, 2).toUpperCase();
                  const avatarColorClass = AVATAR_COLORS[index % AVATAR_COLORS.length];

                  return (
                    <tr key={f.id} className="crm-tr cursor-pointer" onClick={() => setSelectedFollowUp(f)}>
                      <td className="crm-td text-center text-slate-400 text-xs">{index + 1}</td>
                      <td className="crm-td">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${avatarColorClass}`}>{initials}</div>
                          <span className="text-sm font-medium text-slate-700">{displayName}</span>
                        </div>
                      </td>
                      <td className="crm-td text-slate-500 text-xs whitespace-nowrap">{formatDate(f.nextMeetingDate)}</td>
                      <td className="crm-td text-slate-600 text-xs font-medium">{f.type || "—"}</td>
                      <td className="crm-td">
                        {isOverdue ? <StatusBadge status="Overdue" pulse /> :
                         isCompleted ? <StatusBadge status="Completed" /> :
                         isCancelled ? <StatusBadge status="Cancelled" /> :
                         <StatusBadge status="Pending" />}
                      </td>
                      <td className="crm-td"><PriorityBadge priority={f.priority || "Medium"} /></td>
                      <td className="crm-td text-slate-500 text-xs max-w-xs truncate">{f.notes || f.remarks || "—"}</td>
                      <td className="crm-td text-slate-500 text-xs max-w-xs truncate">{f.callNotes || "—"}</td>
                      <td className="crm-td">
                        <div className="flex items-center justify-center gap-1.5">
                          {!isCompleted && !isCancelled && (
                            <>
                              <button onClick={(e) => { e.stopPropagation(); handleOpenEditDrawer(f); }} className="row-action-btn" title="Edit"><Pencil size={13} /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleComplete(f); }} className="row-action-btn" title="Complete"><CheckCircle size={13} /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleCancelClick(f); }} className="row-action-btn row-action-btn-danger" title="Cancel"><Ban size={13} /></button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline Add/Edit Drawer */}
      {isDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
            <div className="w-screen max-w-[460px] bg-white shadow-2xl flex flex-col h-full">
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-[#FAF6F3]">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800">{drawerMode === "add" ? "Add Follow Up" : "Edit Follow Up"}</h2>
                  <p className="text-[10px] text-slate-500 font-medium mt-0.5">Linked to quotation {quotationCode}</p>
                </div>
                <button onClick={() => setIsDrawerOpen(false)} className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto flex flex-col min-h-0">
                <div className="p-6 space-y-5">
                  {errorMsg && (
                    <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-xs font-bold text-red-700 text-center">{errorMsg}</div>
                  )}

                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                    <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">Linked Quotation</p>
                    <p className="text-sm font-bold text-blue-900">{quotationCode}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Date <span className="text-red-500">*</span></label>
                        <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-semibold text-slate-700" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Time <span className="text-red-500">*</span></label>
                        <input type="time" value={followUpTime} onChange={(e) => setFollowUpTime(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-semibold text-slate-700" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Type</label>
                        <select value={followUpType} onChange={(e) => setFollowUpType(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-bold text-slate-700 cursor-pointer">
                          <option value="Call">Call</option>
                          <option value="Meeting">Meeting</option>
                          <option value="Email">Email</option>
                          <option value="WhatsApp">WhatsApp</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Priority</label>
                        <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-bold text-slate-700 cursor-pointer">
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                        </select>
                      </div>
                    </div>

                    {user?.role !== "SalesExecutive" && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Assigned To</label>
                        <select value={assignedToId} onChange={(e) => setAssignedToId(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-bold text-slate-700 cursor-pointer">
                          <option value="">Select Assignee...</option>
                          {users.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Discussion Notes</label>
                      <textarea rows={3} value={discussionNotes} onChange={(e) => setDiscussionNotes(e.target.value)} placeholder="Discussion points, agenda..." className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-medium text-slate-700 resize-none" />
                    </div>

                    {drawerMode === "edit" && (
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Status</label>
                        <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-bold text-slate-700 cursor-pointer">
                          <option value="Pending">Pending</option>
                          <option value="Completed">Completed</option>
                          <option value="Overdue">Overdue</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-6 py-4 border-t border-slate-100 bg-[#FAF6F3] flex justify-end gap-3 shrink-0">
                  <button type="button" onClick={() => setIsDrawerOpen(false)} className="px-5 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancel</button>
                  <button type="submit" disabled={formLoading} className="px-6 py-2 rounded-xl text-xs font-bold text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] cursor-pointer disabled:opacity-50">
                    {formLoading ? "Saving..." : "Save"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <FollowUpDetailModal
        followUp={selectedFollowUp}
        isOpen={!!selectedFollowUp}
        onClose={() => setSelectedFollowUp(null)}
      />
    </>
  );
}

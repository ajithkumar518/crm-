"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  createFollowUpAction,
  getQuotationFollowUpsAction,
  cancelFollowUpAction,
  updateFollowUpAction,
} from "@/app/actions/followUps";
import { getUsersAction } from "@/app/actions/users";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { PageShell } from "@/components/ui/PageShell";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { StatusBadge, PriorityBadge } from "@/components/ui/StatusBadge";
import { isQuotationFollowupAllowed } from "@/lib/feature-allowlist";
import FollowUpDetailModal from "@/components/quotations/FollowUpDetailModal";
import {
  ChevronLeft,
  CalendarClock,
  Plus,
  X,
  Pencil,
  CheckCircle,
  Ban,
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

export default function QuotationFollowUpsPage() {
  const router = useRouter();
  const params = useParams();
  const quotationId = params.quotationId as string;
  const { user } = useAuth();
  const toast = useToast();

  const [followUps, setFollowUps] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFollowUp, setSelectedFollowUp] = useState<any>(null);
  const [quotationInfo, setQuotationInfo] = useState<{ quotationCode: string; customerName: string; status: string } | null>(null);

  // Drawer state
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

  // Redirect non-allowed users
  useEffect(() => {
    if (user && !isFeatureUser) {
      toast.error("You do not have access to quotation follow-ups.");
      router.replace("/follow-up");
    }
  }, [user, isFeatureUser, router, toast]);

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
        // Extract quotation info from the first follow-up if available
        if (fuRes.data.length > 0) {
          const first = fuRes.data[0];
          setQuotationInfo({
            quotationCode: first.quotationCode || first.quotation?.quotationCode || "",
            customerName: first.customer?.name || first.accountReference || "",
            status: first.quotation?.status || "",
          });
        }
      } else if (fuRes.message?.startsWith("Unauthorized")) {
        toast.error(fuRes.message);
        router.replace("/follow-up");
      }
      if (usersRes?.success && usersRes.data) {
        setUsers(usersRes.data.filter((u: any) => u.isActive && (u.role === "SalesExecutive" || u.role === "SalesManager")));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [quotationId, router, toast]);

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
      const res = await cancelFollowUpAction({ id: f.id, notes: "Cancelled from quotation follow-ups" });
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

  // Summary counts
  const pending = followUps.filter(f => f.status === "Pending").length;
  const overdue = followUps.filter(f => f.badgeStatus === "OVERDUE" || (f.status === "Overdue")).length;
  const completed = followUps.filter(f => f.status === "Completed").length;

  if (!isFeatureUser && user) {
    return (
      <PageContainer className="p-6">
        <p className="text-slate-400">Redirecting...</p>
      </PageContainer>
    );
  }

  return (
    <PageShell
      title="Quotation Follow-Ups"
      subtitle={quotationInfo ? `${quotationInfo.quotationCode} — ${quotationInfo.customerName}` : "Loading quotation..."}
      action={
        <button
          onClick={handleOpenAddDrawer}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-white rounded-xl text-xs font-bold hover:bg-[var(--primary-hover)] transition-colors shadow-md cursor-pointer"
        >
          <Plus size={16} />
          Add Follow-up
        </button>
      }
    >
      <PageContainer className="space-y">
        {/* Back link */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/quotations/${quotationId}`)}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[var(--primary)] transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} /> Back to Quotation
          </button>
          <span className="text-slate-300">|</span>
          <Link href="/follow-up" className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[var(--primary)] transition-colors">
            <CalendarClock size={14} /> All Follow-Ups
          </Link>
        </div>

        {/* Quotation context banner */}
        {quotationInfo && (
          <div className="crm-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-2xl">📋</div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">{quotationInfo.quotationCode}</h2>
                <p className="text-sm text-slate-500">{quotationInfo.customerName}</p>
              </div>
            </div>
            {quotationInfo.status && (
              <span className="px-3 py-1 rounded-lg bg-blue-100 text-blue-700 text-xs font-bold">{quotationInfo.status}</span>
            )}
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Total Follow Ups" value={followUps.length} icon={<CalendarClock size={18} />} variant="orange" subtitle="For this quotation" />
          <SummaryCard label="Pending" value={pending} icon={<span className="text-lg font-black">⏳</span>} variant="dark" subtitle="Yet to be completed" />
          <SummaryCard label="Overdue" value={overdue} icon={<span className="text-lg font-black">!</span>} variant="light" subtitle="Past due" />
          <SummaryCard label="Completed" value={completed} icon={<CheckCircle size={18} />} variant="light" subtitle="Successfully closed" />
        </div>

        {/* Follow-ups table */}
        <div className="crm-card mt-6 overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-lg font-extrabold text-slate-800">Quotation Follow-Ups</h3>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="crm-table">
              <thead>
                <tr className="crm-tr border-b border-slate-100">
                  <th className="crm-th text-center">S.No</th>
                  <th className="crm-th">Assigned To</th>
                  <th className="crm-th">Follow-up Date</th>
                  <th className="crm-th">Type</th>
                  <th className="crm-th">Status</th>
                  <th className="crm-th">Priority</th>
                  <th className="crm-th">Notes</th>
                  <th className="crm-th">Call Notes</th>
                  <th className="crm-th text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-10 text-slate-400 text-xs">Loading follow-up records...</td>
                  </tr>
                ) : followUps.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400 text-xs">
                      No follow-ups for this quotation yet. Click "Add Follow-up" to create one.
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
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black shrink-0 ${avatarColorClass}`}>
                              {initials}
                            </div>
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
                                <button onClick={(e) => { e.stopPropagation(); handleOpenEditDrawer(f); }} className="row-action-btn" title="Edit Follow Up">
                                  <Pencil size={14} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleComplete(f); }} className="row-action-btn" title="Mark Completed">
                                  <CheckCircle size={14} />
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); handleCancelClick(f); }} className="row-action-btn row-action-btn-danger" title="Cancel Follow Up">
                                  <Ban size={14} />
                                </button>
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

        {/* Add / Edit Drawer */}
        {isDrawerOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsDrawerOpen(false)}></div>
            <div className="absolute inset-y-0 right-0 pl-10 max-w-full flex">
              <div className="w-screen max-w-[460px] bg-white shadow-2xl flex flex-col h-full">
                {/* Drawer Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-[#FAF6F3]">
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-800">{drawerMode === "add" ? "Add Follow Up" : "Edit Follow Up"}</h2>
                    <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                      {quotationInfo ? `Linked to quotation ${quotationInfo.quotationCode}` : "Linked to quotation"}
                    </p>
                  </div>
                  <button onClick={() => setIsDrawerOpen(false)} className="w-8 h-8 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 cursor-pointer">
                    <X size={20} />
                  </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto flex flex-col min-h-0">
                  <div className="p-6 space-y-5">
                    {errorMsg && (
                      <div className="p-3 bg-red-50 border border-red-150 rounded-xl text-xs font-bold text-red-700 text-center">{errorMsg}</div>
                    )}

                    {/* Quotation context (read-only) */}
                    {quotationInfo && (
                      <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider mb-1">Linked Quotation</p>
                        <p className="text-sm font-bold text-blue-900">{quotationInfo.quotationCode}</p>
                        <p className="text-[10px] text-blue-600 mt-0.5">{quotationInfo.customerName}</p>
                      </div>
                    )}

                    {/* Follow Up Details */}
                    <div className="space-y-3">
                      <h3 className="text-xs font-black text-[#B3592D] uppercase tracking-wider border-b border-slate-100 pb-1.5">Follow Up Details</h3>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Follow-up Date <span className="text-red-500">*</span></label>
                          <input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-semibold text-slate-700" />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Follow-up Time <span className="text-red-500">*</span></label>
                          <input type="time" value={followUpTime} onChange={(e) => setFollowUpTime(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-semibold text-slate-700" />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Follow-up Type</label>
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
                        <textarea rows={3} value={discussionNotes} onChange={(e) => setDiscussionNotes(e.target.value)} placeholder="Discussion points, agenda, customer response..." className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-250 text-xs font-medium text-slate-700 resize-none" />
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

                  {/* Footer */}
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
      </PageContainer>

      <FollowUpDetailModal
        followUp={selectedFollowUp}
        isOpen={!!selectedFollowUp}
        onClose={() => setSelectedFollowUp(null)}
      />
    </PageShell>
  );
}

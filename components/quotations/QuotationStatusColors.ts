export const statusColors: Record<string, string> = {
  // Spec 13 statuses
  Draft: "bg-slate-100 text-slate-600 border border-slate-200/50",
  "Quotation Sent": "bg-blue-100 text-blue-700 border border-blue-200/50",
  "Follow-up": "bg-cyan-100 text-cyan-700 border border-cyan-200/50",
  "Revised Rate": "bg-indigo-100 text-indigo-700 border border-indigo-200/50",
  Accepted: "bg-green-100 text-green-700 border border-green-200/50",
  Rejected: "bg-red-100 text-red-700 border border-red-200/50",
  MOQ: "bg-orange-100 text-orange-700 border border-orange-200/50",
  "Material Not Available": "bg-rose-100 text-rose-700 border border-rose-200/50",
  "No Stock": "bg-amber-100 text-amber-700 border border-amber-200/50",
  "Price Pending": "bg-yellow-100 text-yellow-700 border border-yellow-200/50",
  "Supplier Rate Checking": "bg-violet-100 text-violet-700 border border-violet-200/50",
  "Converted to Customer": "bg-emerald-100 text-emerald-700 border border-emerald-200/50",
  Others: "bg-gray-100 text-gray-600 border border-gray-200/50",
  // System/internal statuses (kept for backward compatibility)
  UnderReview: "bg-amber-100 text-amber-700 border border-amber-200/50",
  Expired: "bg-gray-100 text-gray-500 border border-gray-200/50",
  PendingApproval: "bg-orange-100 text-orange-700 border border-orange-200/50",
  Approved: "bg-green-100 text-green-700 border border-green-200/50",
  OnHold: "bg-zinc-100 text-zinc-600 border border-zinc-200/50",
  // Legacy fallback for old DB records
  Sent: "bg-blue-100 text-blue-700 border border-blue-200/50",
};

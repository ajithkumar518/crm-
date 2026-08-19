"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getCustomersAction, getCustomerByIdAction, createCustomerAction, updateCustomerAction, deleteCustomersAction } from "@/app/actions/customers";
import { getUsersAction } from "@/app/actions/users";
import { Customer, User } from "@/types";
import { useAuth } from "@/components/AuthProvider";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useToast } from "@/components/ToastProvider";
import PageContainer from "@/components/PageContainer";
import { useGlobalLoading } from "@/components/GlobalLoadingProvider";
import { SummaryCard } from "@/components/ui/SummaryCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { validateEmail, validatePhone, validateAlphabetic } from "@/lib/formValidation";
import CustomerImportModal from "@/components/customers/CustomerImportModal";

const Ico = ({ d, size = 16, className }: { d: string; size?: number; className?: string }) => (
  <svg width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);

const icons = {
  plus: "M12 4v16m8-8H4",
  search: "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  filter: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z",
  x: "M6 18L18 6M6 6l12 12",
  users: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  check: "M5 13l4 4L19 7",
  clock: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  map: "M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
};

export default function CustomerMasterPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { startLoading, stopLoading } = useGlobalLoading();
  const [search, setSearch] = useState("");
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "");
  const [leadSourceFilter, setLeadSourceFilter] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuth();
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [executives, setExecutives] = useState<User[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [formLoading, setFormLoading] = useState(false);
  const toast = useToast();
  const [confirmState, setConfirmState] = useState<{isOpen: boolean; title: string; message: string; action: () => void}>({ isOpen: false, title: "", message: "", action: () => {} });
  const [isImportOpen, setIsImportOpen] = useState(false);

  const [formData, setFormData] = useState({
    id: "",
    customerCode: "",
    name: "",
    email: "",
    phone: "",
    city: "",
    state: "",
    status: "Prospect" as any,
    assignedUserId: "",
    leadSource: "",
    gstNumber: "",
    billingAddress: "",
    shippingAddress: "",
    paymentTerms: "",
    creditTermsDays: "",
    customerCategory: "",
    industryType: "",
    contactPerson: "",
    contactMobile: "",
    contactEmail: "",
  });

  const loadCustomers = async () => {
    setLoading(true);
    startLoading("Loading customers...");
    try {
      const params: any = {};
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (leadSourceFilter) params.leadSource = leadSourceFilter;

      const res = await getCustomersAction(params);
      if (res.success && res.data) {
        setCustomers(res.data as any);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      stopLoading();
    }
  };

  const loadExecutives = async () => {
    if (user?.role === "Admin" || user?.role === "SalesManager") {
      const res = await getUsersAction();
      if (res.success && res.data) {
        setExecutives(res.data.filter((u: any) => u.role === "SalesExecutive") as any);
      }
    }
  };

  useEffect(() => {
    setStatusFilter(searchParams.get("status") || "");
  }, [searchParams]);

  useEffect(() => {
    loadCustomers();
  }, [search, statusFilter, leadSourceFilter]);

  useEffect(() => {
    loadExecutives();
  }, [user]);

  const exportToCSV = () => {
    if (customers.length === 0) {
      toast.error("No data available to export.");
      return;
    }
    
    // Headers
    const headers = ["ID", "Customer Code", "Name", "Email", "Phone", "City", "Status", "Lead Source", "Created At"];
    
    // Rows
    const rows = customers.map(c => [
      c.id,
      c.customerCode,
      c.name,
      c.email || "",
      c.phone || "",
      c.city || "",
      c.status,
      c.leadSource || "",
      c.createdAt ? new Date(c.createdAt).toLocaleString() : ""
    ]);
    
    // Construct CSV content
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");
    
    // Trigger download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Customers_Export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV export initiated successfully.");
  };

  const openCreateModal = () => {
    setFormData({
      id: "",
      customerCode: "",
      name: "",
      email: "",
      phone: "",
      city: "",
      state: "",
      status: "Prospect",
      assignedUserId: "",
      leadSource: "",
      gstNumber: "",
      billingAddress: "",
      shippingAddress: "",
      paymentTerms: "",
      creditTermsDays: "",
      customerCategory: "",
      industryType: "",
      contactPerson: "",
      contactMobile: "",
      contactEmail: "",
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const openEditModal = async (c: Customer) => {
    const res = await getCustomerByIdAction(c.id);
    const d = res.success && res.data ? res.data : c;
    const primary = (d as any).contacts?.find((cn: any) => cn.isPrimary) || (d as any).contacts?.[0];
    setFormData({
      id: d.id,
      customerCode: d.customerCode,
      name: d.name,
      email: d.email || "",
      phone: d.phone || "",
      city: d.city || "",
      state: d.state || "",
      status: d.status,
      assignedUserId: d.assignedUserId || "",
      leadSource: d.leadSource || "",
      gstNumber: d.gstNumber || "",
      billingAddress: d.billingAddress || "",
      shippingAddress: d.shippingAddress || "",
      paymentTerms: d.paymentTerms || "",
      creditTermsDays: d.creditTermsDays != null ? String(d.creditTermsDays) : "",
      customerCategory: d.customerCategory || "",
      industryType: d.industryType || "",
      contactPerson: primary?.name || "",
      contactMobile: primary?.phone || "",
      contactEmail: primary?.email || "",
    });
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);
    setErrorMsg("");

    if (!formData.name.trim()) {
      setErrorMsg("Customer Name is required");
      setFormLoading(false);
      return;
    }

    if (formData.id && !formData.customerCode.trim()) {
      setErrorMsg("Customer Code is required for updating");
      setFormLoading(false);
      return;
    }

    if (!formData.leadSource || formData.leadSource.trim() === "") {
      setErrorMsg("Lead Source is required");
      setFormLoading(false);
      return;
    }

    const emailErr = validateEmail(formData.email);
    if (emailErr) { setErrorMsg(emailErr); setFormLoading(false); return; }
    const phoneErr = validatePhone(formData.phone);
    if (phoneErr) { setErrorMsg(phoneErr); setFormLoading(false); return; }
    const cityErr = validateAlphabetic(formData.city, "City");
    if (cityErr) { setErrorMsg(cityErr); setFormLoading(false); return; }

    let res;
    if (formData.id) {
      res = await updateCustomerAction(formData);
    } else {
      res = await createCustomerAction(formData);
    }

    if (res.success) {
      setIsModalOpen(false);
      loadCustomers();
    } else {
      setErrorMsg(res.message || "Operation failed");
    }
    setFormLoading(false);
  };

  const toggleAll = () => {
    if (selectedIds.length === customers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(customers.map(c => c.id));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleDeleteSelected = () => {
    setConfirmState({
      isOpen: true,
      title: "Delete Customers",
      message: `Are you sure you want to permanently delete ${selectedIds.length} customer(s)? This will erase ALL their visits, subscriptions, and portal access. This action CANNOT be undone.`,
      action: async () => {
        setIsDeleting(true);
        const res = await deleteCustomersAction(selectedIds);
        setIsDeleting(false);
        if (res.success) {
          toast.success(res.message || "Customers deleted.");
          setSelectedIds([]);
          loadCustomers();
        } else {
          toast.error(res.message || "Failed to delete customers.");
        }
      }
    });
  };

  const handleDeleteOne = (c: Customer) => {
    setConfirmState({
      isOpen: true,
      title: "Delete Customer",
      message: `Delete "${c.name}" (${c.customerCode})?\n\nThis will permanently erase ALL their visits, subscriptions, and portal access.\n\nThis action CANNOT be undone.`,
      action: async () => {
        setIsDeleting(true);
        const res = await deleteCustomersAction([c.id]);
        setIsDeleting(false);
        if (res.success) {
          toast.success(`"${c.name}" has been deleted.`);
          setSelectedIds(prev => prev.filter(x => x !== c.id));
          loadCustomers();
        } else {
          toast.error(res.message || "Failed to delete customer.");
        }
      }
    });
  };


  return (
    <PageContainer className="space-y-4">
      {/* Header Area */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: 500, color: "var(--text-primary)" }}>Accounts Overview</h1>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginTop: "4px" }}>Manage and track your active customers and prospects.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-md text-[13px] font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </button>
          {(user?.role === "Admin" || user?.role === "SuperAdmin" || user?.role === "SalesManager") && (
            <button
              onClick={() => setIsImportOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-md text-[13px] font-bold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            >
              <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Import Customers
            </button>
          )}
          <button 
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-3 py-2 bg-[var(--primary)] text-white rounded-md text-[13px] font-medium hover:bg-[var(--primary-hover)] transition-colors shadow-sm cursor-pointer"
          >
            <Ico d={icons.plus} size={16} />
            Create Customer
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Customers"
          value={customers.length}
          subtitle="All customer accounts"
        />
        <SummaryCard
          label="Active"
          value={customers.filter(c => c.status === "ActiveCustomer" || c.status === "Renewed").length}
          subtitle="Active clients"
        />
        <SummaryCard
          label="Prospects"
          value={customers.filter(c => c.status === "Prospect").length}
          subtitle="Prospect accounts"
        />
        <SummaryCard
          label="Churned"
          value={customers.filter(c => c.status === "Churned").length}
          subtitle="Churned accounts"
        />
      </div>


      {/* Main Table */}
      <div className="crm-card overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h3 className="text-lg font-bold text-slate-800">Customers List</h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Ico d={icons.search} size={16} />
              </span>
              <input 
                type="text" 
                placeholder="Search customers..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="Prospect">Prospect</option>
              <option value="ActiveCustomer">Active Customer</option>
              <option value="Renewed">Renewed</option>
              <option value="Churned">Churned</option>
            </select>
            <select 
              value={leadSourceFilter}
              onChange={(e) => setLeadSourceFilter(e.target.value)}
              className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-600 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
            >
              <option value="">All Lead Sources</option>
              <option value="Website">Website</option>
              <option value="IndiaMART">IndiaMART</option>
              <option value="Justdial">Justdial</option>
              <option value="TradeIndia">TradeIndia</option>
              <option value="WhatsApp">WhatsApp</option>
              <option value="Door-to-Door Marketing">Door-to-Door Marketing</option>
              <option value="Direct Visit">Direct Visit</option>
              <option value="Telephonic Conversation">Telephonic Conversation</option>
              <option value="Email">Email</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {selectedIds.length > 0 && (
            <div className="bg-slate-800 text-white px-5 py-3 flex items-center justify-between text-sm font-medium animate-in fade-in slide-in-from-top-4">
              <span>{selectedIds.length} customer(s) selected</span>
              <button 
                onClick={handleDeleteSelected}
                disabled={isDeleting}
                className="px-4 py-1.5 bg-red-500 hover:bg-red-600 rounded-md transition-colors flex items-center gap-2 shadow-sm border border-red-400 text-xs"
              >
                {isDeleting ? "Deleting..." : "Delete Selected"}
              </button>
            </div>
          )}
          <table className="crm-table">
            <thead>
              <tr className="crm-tr border-b border-slate-100">
                <th className="crm-th">Customer Code</th>
                <th className="crm-th">Customer Name</th>
                <th className="crm-th">City</th>
                <th className="crm-th">Status</th>
                <th className="crm-th text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-sm text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-sm text-slate-500">
                    No customers found.
                  </td>
                </tr>
              ) : (
                customers.map(c => (
                  <tr
                    key={c.id}
                    className="crm-tr table-row-clickable"
                    onClick={() => router.push(`/customer-master/${c.id}?status=${c.status}`)}
                  >
                    <td className="crm-td text-slate-500 font-medium">{c.customerCode}</td>
                    <td className="crm-td">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-red-100 text-[var(--primary)] flex items-center justify-center text-[10px] font-bold shrink-0">
                          {c.name.substring(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="row-primary-link block leading-tight">{c.name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-slate-400 block leading-tight">{c.email || "No email"}</span>
                            {c.leadSource && (
                              <span className="text-[9px] px-1 bg-slate-100 text-slate-500 border border-slate-200 rounded font-semibold uppercase tracking-wider">
                                {c.leadSource}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="crm-td text-slate-600">{c.city || "-"}</td>
                    <td className="crm-td"><StatusBadge status={c.status} showDot /></td>
                    <td className="crm-td text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(c)}
                          className="row-action-btn"
                          title="Edit Customer"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        </button>
                        {(user?.role === "Admin" || user?.role === "SalesManager") && (
                          <button
                            onClick={() => handleDeleteOne(c)}
                            disabled={isDeleting}
                            className="row-action-btn row-action-btn-danger"
                            title="Delete Customer"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-red-50 to-slate-50 shrink-0">
              <h2 className="text-base font-bold text-slate-800">
                {formData.id ? "Edit Customer Record" : "Add New Customer"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-xl bg-white/80 border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-all cursor-pointer">
                <Ico d={icons.x} size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="p-6 overflow-y-auto space-y-4">
                {errorMsg && (
                  <div className="p-3 rounded-[8px] bg-[#ffdad6] border border-[#ffb4ab] text-[13px] text-[#93000a] font-medium text-center">
                    {errorMsg}
                  </div>
                )}
                {!formData.id ? (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Customer Code
                    </label>
                    <input 
                      type="text" 
                      disabled
                      value="Auto-generated upon save"
                      className="w-full px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-sm text-slate-500 font-semibold cursor-not-allowed" 
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                      Customer Code <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      required
                      disabled
                      value={formData.customerCode}
                      onChange={(e) => setFormData({ ...formData, customerCode: e.target.value })}
                      placeholder="e.g. RAM-101" 
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all disabled:opacity-60 cursor-not-allowed" 
                    />
                    <p className="text-xs text-slate-500 mt-1">Manual identifier code (cannot be changed once created).</p>
                  </div>
                )}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter customer name" 
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                    <input 
                      type="email" 
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Email address" 
                      className={`w-full px-4 py-2 rounded-xl bg-slate-50 border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all ${formData.email && validateEmail(formData.email) ? "border-rose-500" : "border-slate-200"}`} 
                    />
                    {formData.email && validateEmail(formData.email) && <p className="text-xs text-rose-500 mt-1">{validateEmail(formData.email)}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Phone</label>
                    <input 
                      type="tel" 
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="Phone number" 
                      className={`w-full px-4 py-2 rounded-xl bg-slate-50 border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all ${formData.phone && validatePhone(formData.phone) ? "border-rose-500" : "border-slate-200"}`} 
                    />
                    {formData.phone && validatePhone(formData.phone) && <p className="text-xs text-rose-500 mt-1">{validatePhone(formData.phone)}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">City</label>
                    <input 
                      type="text" 
                      value={formData.city}
                      onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                      placeholder="City" 
                      className={`w-full px-4 py-2 rounded-xl bg-slate-50 border text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all ${formData.city && validateAlphabetic(formData.city, "City") ? "border-rose-500" : "border-slate-200"}`} 
                    />
                    {formData.city && validateAlphabetic(formData.city, "City") && <p className="text-xs text-rose-500 mt-1">{validateAlphabetic(formData.city, "City")}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Status</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
                    >
                      <option value="Prospect">Prospect</option>
                      <option value="ActiveCustomer">Active Customer</option>
                      <option value="Renewed">Renewed</option>
                      <option value="Churned">Churned</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Lead Source <span className="text-red-500">*</span></label>
                    <select 
                      value={formData.leadSource}
                      onChange={(e) => setFormData({ ...formData, leadSource: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
                    >
                      <option value="">Select Source</option>
                      <option value="Website">Website</option>
                      <option value="IndiaMART">IndiaMART</option>
                      <option value="Justdial">Justdial</option>
                      <option value="TradeIndia">TradeIndia</option>
                      <option value="WhatsApp">WhatsApp</option>
                      <option value="Door-to-Door Marketing">Door-to-Door Marketing</option>
                      <option value="Direct Visit">Direct Visit</option>
                      <option value="Telephonic Conversation">Telephonic Conversation</option>
                      <option value="Email">Email</option>
                    </select>
                  </div>
                  {(user?.role === "Admin" || user?.role === "SalesManager") ? (
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Assign to Executive</label>
                      <select 
                        value={formData.assignedUserId}
                        onChange={(e) => setFormData({ ...formData, assignedUserId: e.target.value })}
                        className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
                      >
                        <option value="">Unassigned</option>
                        {executives.map(exec => (
                          <option key={exec.id} value={exec.id}>{exec.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : <div />}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">GST Number</label>
                    <input 
                      type="text" 
                      value={formData.gstNumber}
                      onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                      placeholder="15-character GSTIN" 
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Customer Category</label>
                    <select 
                      value={formData.customerCategory}
                      onChange={(e) => setFormData({ ...formData, customerCategory: e.target.value })}
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all cursor-pointer"
                    >
                      <option value="">Select Category</option>
                      <option value="80-20">80-20</option>
                      <option value="NON-80-20">NON-80-20</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">State</label>
                    <input 
                      type="text" 
                      value={formData.state}
                      onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                      placeholder="State" 
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Industry Type</label>
                    <input 
                      type="text" 
                      value={formData.industryType}
                      onChange={(e) => setFormData({ ...formData, industryType: e.target.value })}
                      placeholder="e.g. Manufacturing" 
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Payment Terms</label>
                    <input 
                      type="text" 
                      value={formData.paymentTerms}
                      onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                      placeholder="e.g. Net 30" 
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Credit Days</label>
                    <input 
                      type="number" 
                      value={formData.creditTermsDays}
                      onChange={(e) => setFormData({ ...formData, creditTermsDays: e.target.value })}
                      placeholder="30" 
                      className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Billing Address</label>
                  <textarea 
                    value={formData.billingAddress}
                    onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                    placeholder="Billing address"
                    rows={2}
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Shipping Address</label>
                  <textarea 
                    value={formData.shippingAddress}
                    onChange={(e) => setFormData({ ...formData, shippingAddress: e.target.value })}
                    placeholder="Shipping address (if different)"
                    rows={2}
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none" 
                  />
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Primary Contact Person</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Person</label>
                      <input 
                        type="text" 
                        value={formData.contactPerson}
                        onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                        placeholder="Name" 
                        className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mobile</label>
                      <input 
                        type="tel" 
                        value={formData.contactMobile}
                        onChange={(e) => setFormData({ ...formData, contactMobile: e.target.value })}
                        placeholder="Mobile number" 
                        className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contact Email</label>
                    <input 
                      type="email" 
                      value={formData.contactEmail}
                      onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                      placeholder="contact@company.com" 
                      className="w-full px-4 py-2 rounded-xl bg-white border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all" 
                    />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)} 
                  className="px-5 py-2 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={formLoading}
                  className="px-5 py-2 rounded-xl text-sm font-medium text-white bg-[var(--primary)] hover:bg-[var(--primary-hover)] transition-colors shadow-sm disabled:opacity-75 cursor-pointer"
                >
                  {formLoading ? "Saving..." : "Save Customer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.action}
        onCancel={() => setConfirmState(prev => ({ ...prev, isOpen: false }))}
        isDestructive={true}
      />

      <CustomerImportModal
        open={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportDone={loadCustomers}
      />
    </PageContainer>
  );
}

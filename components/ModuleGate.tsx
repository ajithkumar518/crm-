"use client";

import { ReactNode, useCallback } from "react";
import { Lock, Search, Filter, Plus, FileText, CheckCircle2, TrendingUp, Layers, ShieldCheck, DollarSign, Clock, Swords } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { hasModule, type ModuleCheckSubject } from "@/lib/modules";
import { ModuleKey, MODULE_KEYS, getMinimumVariantForModule } from "@/lib/config/moduleVariantMap";
import { CollapsibleSection } from "@/components/ui/CollapsibleSection";

const MODULE_LABELS: Record<string, string> = {
  [MODULE_KEYS.MANAGER_DASHBOARD]: "Manager Dashboard",
  [MODULE_KEYS.CUSTOMER_VISITS]: "Customer Visits",
  [MODULE_KEYS.PRODUCT_CATALOGUE]: "Product Catalogue",
  [MODULE_KEYS.RFQ]: "RFQ Management",
  [MODULE_KEYS.SAMPLE_MANAGEMENT]: "Sample Management",
  [MODULE_KEYS.NEGOTIATION]: "Negotiation Management",
  [MODULE_KEYS.DOCUMENTS]: "Document Management",
  [MODULE_KEYS.APPROVAL_CENTER]: "Approval Center",
  [MODULE_KEYS.COMPETITORS]: "Competitors",
  [MODULE_KEYS.DEALS]: "Deals",
  [MODULE_KEYS.PURCHASE_ORDERS]: "Purchase Orders",
  [MODULE_KEYS.CUSTOMER_ASSETS]: "Customer Assets",
  [MODULE_KEYS.KEY_ACCOUNTS]: "Key Accounts",
  [MODULE_KEYS.TERRITORIES]: "Territories",
  [MODULE_KEYS.TARGETS]: "Targets",
  [MODULE_KEYS.FORECAST]: "Forecast",
};

/**
 * Generates realistic, domain-specific static mock content for previews.
 * This content is strictly static HTML/CSS (no network requests, no live data)
 * and will be blurred and rendered non-interactive.
 */
function renderMockContent(module?: ModuleKey | string, variantMin?: number) {
  // 1. Competitor Intelligence Mock
  if (module === MODULE_KEYS.COMPETITORS || module === "competitors") {
    return (
      <div className="space-y-4 text-left font-sans">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-64 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center px-3 text-slate-400 text-xs">
              <Search size={14} className="mr-2" /> Search competitor records...
            </div>
            <div className="h-8 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center text-slate-500 text-xs gap-1.5">
              <Filter size={13} /> Threat Level: All
            </div>
          </div>
          <div className="h-8 px-3.5 bg-[var(--primary)] text-white font-bold rounded-lg flex items-center text-xs gap-1">
            <Plus size={14} /> Add Competitor
          </div>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
              <th className="py-2.5 px-3">Competitor Name</th>
              <th className="py-2.5 px-3">Threat Level</th>
              <th className="py-2.5 px-3">Our Price vs Quoted</th>
              <th className="py-2.5 px-3">Win/Loss Status</th>
              <th className="py-2.5 px-3">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-350">
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">Apex Global Solutions</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">High Threat</span></td>
              <td className="py-3 px-3 font-mono">Rs. 4,50,000 vs 4,20,000</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">Evaluating</span></td>
              <td className="py-3 px-3 text-slate-400">Yesterday</td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">TechCorp Enterprise India</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Medium</span></td>
              <td className="py-3 px-3 font-mono">Rs. 1,20,000 vs 1,25,000</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Won Deal</span></td>
              <td className="py-3 px-3 text-slate-400">3 days ago</td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">Zenith Software Systems</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Low Threat</span></td>
              <td className="py-3 px-3 font-mono">Rs. 8,90,000 vs 9,40,000</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">Shortlisted</span></td>
              <td className="py-3 px-3 text-slate-400">Jul 18, 2026</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // 2. Document Management Mock
  if (module === MODULE_KEYS.DOCUMENTS || module === "documents") {
    return (
      <div className="space-y-4 text-left font-sans">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-64 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center px-3 text-slate-400 text-xs">
              <Search size={14} className="mr-2" /> Search files and drawings...
            </div>
            <div className="h-8 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center text-slate-500 text-xs gap-1.5">
              <Filter size={13} /> Type: All Documents
            </div>
          </div>
          <div className="h-8 px-3.5 bg-[var(--primary)] text-white font-bold rounded-lg flex items-center text-xs gap-1">
            <Plus size={14} /> Upload Document
          </div>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
              <th className="py-2.5 px-3">Document Name</th>
              <th className="py-2.5 px-3">Category / Type</th>
              <th className="py-2.5 px-3">Linked Entity</th>
              <th className="py-2.5 px-3">File Size</th>
              <th className="py-2.5 px-3">Uploaded By</th>
              <th className="py-2.5 px-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-350">
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><FileText size={15} className="text-blue-500" /> Master_MSA_Agreement_2026_Signed.pdf</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">Agreement</span></td>
              <td className="py-3 px-3">Acme Corp India</td>
              <td className="py-3 px-3 font-mono">3.4 MB</td>
              <td className="py-3 px-3">Sandhiya S.</td>
              <td className="py-3 px-3 text-slate-400">Today, 10:42 AM</td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><FileText size={15} className="text-emerald-500" /> Technical_Architecture_Spec_v2.docx</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">Technical Spec</span></td>
              <td className="py-3 px-3">Project Titan Rollout</td>
              <td className="py-3 px-3 font-mono">1.8 MB</td>
              <td className="py-3 px-3">Rahul V.</td>
              <td className="py-3 px-3 text-slate-400">Yesterday</td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><FileText size={15} className="text-amber-500" /> Commercial_Proposal_Q3_Rev4.pdf</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">Quotation</span></td>
              <td className="py-3 px-3">Deal #4092</td>
              <td className="py-3 px-3 font-mono">2.1 MB</td>
              <td className="py-3 px-3">Priya K.</td>
              <td className="py-3 px-3 text-slate-400">Jul 20, 2026</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // 3. Negotiation Management Mock
  if (module === MODULE_KEYS.NEGOTIATION || module === "negotiations") {
    return (
      <div className="space-y-4 text-left font-sans">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-64 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center px-3 text-slate-400 text-xs">
              <Search size={14} className="mr-2" /> Search active negotiations...
            </div>
            <div className="h-8 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center text-slate-500 text-xs gap-1.5">
              <Filter size={13} /> Stage: Active Discussion
            </div>
          </div>
          <div className="h-8 px-3.5 bg-[var(--primary)] text-white font-bold rounded-lg flex items-center text-xs gap-1">
            <Plus size={14} /> New Negotiation
          </div>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
              <th className="py-2.5 px-3">Negotiation ID</th>
              <th className="py-2.5 px-3">Deal / Customer Account</th>
              <th className="py-2.5 px-3">Discussion Stage</th>
              <th className="py-2.5 px-3">Our Quoted Price</th>
              <th className="py-2.5 px-3">Customer Target Price</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Next Action Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-350">
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">NEG-2026-0084</td>
              <td className="py-3 px-3">Enterprise CRM Rollout / Apex Ltd</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">Commercial Terms</span></td>
              <td className="py-3 px-3 font-mono font-semibold">Rs. 18,50,000</td>
              <td className="py-3 px-3 font-mono text-amber-700">Rs. 16,00,000</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Active</span></td>
              <td className="py-3 px-3 text-slate-400">Tomorrow</td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">NEG-2026-0079</td>
              <td className="py-3 px-3">Annual Maintenance Contract / TechCorp</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">Price Revision</span></td>
              <td className="py-3 px-3 font-mono font-semibold">Rs. 4,20,000</td>
              <td className="py-3 px-3 font-mono text-amber-700">Rs. 3,80,000</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">Pending Approval</span></td>
              <td className="py-3 px-3 text-slate-400">Jul 28, 2026</td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">NEG-2026-0062</td>
              <td className="py-3 px-3">Cloud Migration Suite / Zenith Inc</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-medium">Final Sign-off</span></td>
              <td className="py-3 px-3 font-mono font-semibold">Rs. 25,00,000</td>
              <td className="py-3 px-3 font-mono text-emerald-700">Rs. 24,00,000</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Closed - Success</span></td>
              <td className="py-3 px-3 text-slate-400">Jul 21, 2026</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // 4. Approval Center Mock
  if (module === MODULE_KEYS.APPROVAL_CENTER || module === "approvals") {
    return (
      <div className="space-y-4 text-left font-sans">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-64 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center px-3 text-slate-400 text-xs">
              <Search size={14} className="mr-2" /> Filter pending approvals...
            </div>
            <div className="h-8 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center text-slate-500 text-xs gap-1.5">
              <Filter size={13} /> Status: Pending Review
            </div>
          </div>
          <div className="h-8 px-3.5 bg-emerald-600 text-white font-bold rounded-lg flex items-center text-xs gap-1">
            <CheckCircle2 size={14} /> Bulk Approve
          </div>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
              <th className="py-2.5 px-3">Approval ID</th>
              <th className="py-2.5 px-3">Type</th>
              <th className="py-2.5 px-3">Requester</th>
              <th className="py-2.5 px-3">Value / Discount</th>
              <th className="py-2.5 px-3">Business Justification</th>
              <th className="py-2.5 px-3">SLA Status</th>
              <th className="py-2.5 px-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-350">
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">APP-2026-0142</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold">Special Discount (15%)</span></td>
              <td className="py-3 px-3 font-medium">Rahul Verma</td>
              <td className="py-3 px-3 font-mono">Rs. 12,40,000</td>
              <td className="py-3 px-3 text-slate-500 truncate max-w-[180px]">Competitor price matching for strategic KAM client</td>
              <td className="py-3 px-3"><span className="text-emerald-600 font-bold">In SLA (2h left)</span></td>
              <td className="py-3 px-3"><div className="flex gap-1.5"><span className="px-2 py-1 bg-emerald-600 text-white font-bold rounded">Approve</span><span className="px-2 py-1 bg-slate-200 text-slate-700 font-bold rounded">Reject</span></div></td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">APP-2026-0138</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-bold">Quotation Margin</span></td>
              <td className="py-3 px-3 font-medium">Priya Sharma</td>
              <td className="py-3 px-3 font-mono">Rs. 45,00,000</td>
              <td className="py-3 px-3 text-slate-500 truncate max-w-[180px]">Multi-year commitment deal terms exception</td>
              <td className="py-3 px-3"><span className="text-emerald-600 font-bold">In SLA (5h left)</span></td>
              <td className="py-3 px-3"><div className="flex gap-1.5"><span className="px-2 py-1 bg-emerald-600 text-white font-bold rounded">Approve</span><span className="px-2 py-1 bg-slate-200 text-slate-700 font-bold rounded">Reject</span></div></td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">APP-2026-0129</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-bold">Payment Terms (60d)</span></td>
              <td className="py-3 px-3 font-medium">Vikram Singh</td>
              <td className="py-3 px-3 font-mono">Rs. 8,50,000</td>
              <td className="py-3 px-3 text-slate-500 truncate max-w-[180px]">Standard government vendor procurement clause</td>
              <td className="py-3 px-3"><span className="text-red-600 font-bold">Overdue by 1 day</span></td>
              <td className="py-3 px-3"><div className="flex gap-1.5"><span className="px-2 py-1 bg-emerald-600 text-white font-bold rounded">Approve</span><span className="px-2 py-1 bg-slate-200 text-slate-700 font-bold rounded">Reject</span></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // 5. Sample Management Mock
  if (module === MODULE_KEYS.SAMPLE_MANAGEMENT || module === "samples") {
    return (
      <div className="space-y-4 text-left font-sans">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-64 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center px-3 text-slate-400 text-xs">
              <Search size={14} className="mr-2" /> Search sample dispatches...
            </div>
            <div className="h-8 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center text-slate-500 text-xs gap-1.5">
              <Filter size={13} /> Status: In Progress
            </div>
          </div>
          <div className="h-8 px-3.5 bg-[var(--primary)] text-white font-bold rounded-lg flex items-center text-xs gap-1">
            <Plus size={14} /> Request Sample
          </div>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
              <th className="py-2.5 px-3">Sample ID</th>
              <th className="py-2.5 px-3">Customer Account / Opportunity</th>
              <th className="py-2.5 px-3">Product Name & Spec</th>
              <th className="py-2.5 px-3">Qty</th>
              <th className="py-2.5 px-3">Dispatch Status</th>
              <th className="py-2.5 px-3">Customer Testing Result</th>
              <th className="py-2.5 px-3">Turnaround</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-350">
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">SMP-2026-0091</td>
              <td className="py-3 px-3">BioHealth Labs / Q3 Supply Deal</td>
              <td className="py-3 px-3 font-medium">Industrial Filter Membrane v4</td>
              <td className="py-3 px-3 font-mono">5 Units</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">Dispatched</span></td>
              <td className="py-3 px-3 text-slate-500">Awaiting Lab Evaluation</td>
              <td className="py-3 px-3 font-mono">2 Days</td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">SMP-2026-0088</td>
              <td className="py-3 px-3">ChemCorp India / Annual Tender</td>
              <td className="py-3 px-3 font-medium">Polymer Composite Coating 500g</td>
              <td className="py-3 px-3 font-mono">2 Kg</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Delivered</span></td>
              <td className="py-3 px-3"><span className="text-emerald-700 font-bold">Approved - Meets Specs</span></td>
              <td className="py-3 px-3 font-mono">4 Days</td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">SMP-2026-0082</td>
              <td className="py-3 px-3">AgroTech Solutions / New Line</td>
              <td className="py-3 px-3 font-medium">Organic Millet Extract Sample B</td>
              <td className="py-3 px-3 font-mono">10 Units</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">In Preparation</span></td>
              <td className="py-3 px-3 text-slate-400">—</td>
              <td className="py-3 px-3 font-mono">1 Day</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // 6. Deals Management Mock
  if (module === MODULE_KEYS.DEALS || module === "deals") {
    return (
      <div className="space-y-4 text-left font-sans">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-64 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center px-3 text-slate-400 text-xs">
              <Search size={14} className="mr-2" /> Search active deals...
            </div>
            <div className="h-8 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center text-slate-500 text-xs gap-1.5">
              <Filter size={13} /> Stage: All Active
            </div>
          </div>
          <div className="h-8 px-3.5 bg-[var(--primary)] text-white font-bold rounded-lg flex items-center text-xs gap-1">
            <Plus size={14} /> Create Deal
          </div>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
              <th className="py-2.5 px-3">Deal ID</th>
              <th className="py-2.5 px-3">Deal Title</th>
              <th className="py-2.5 px-3">Customer Account</th>
              <th className="py-2.5 px-3">Current Pipeline Stage</th>
              <th className="py-2.5 px-3">Expected Value</th>
              <th className="py-2.5 px-3">Win Probability</th>
              <th className="py-2.5 px-3">Expected Close Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-350">
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">DL-2026-0412</td>
              <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">Pan-India Logistics Automation Phase 1</td>
              <td className="py-3 px-3">BlueDart Express India</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-purple-50 text-purple-700 font-medium">Negotiation</span></td>
              <td className="py-3 px-3 font-mono font-bold">Rs. 65,00,000</td>
              <td className="py-3 px-3"><span className="text-emerald-600 font-bold">85%</span></td>
              <td className="py-3 px-3 text-slate-500">Aug 15, 2026</td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">DL-2026-0398</td>
              <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">Cloud Infrastructure Maintenance & Security</td>
              <td className="py-3 px-3">Infosys Technologies Ltd</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">Quotation Sent</span></td>
              <td className="py-3 px-3 font-mono font-bold">Rs. 28,40,000</td>
              <td className="py-3 px-3"><span className="text-blue-600 font-bold">60%</span></td>
              <td className="py-3 px-3 text-slate-500">Aug 30, 2026</td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200">DL-2026-0385</td>
              <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">Smart Warehouse AI Vision Sensors</td>
              <td className="py-3 px-3">Mahindra Logistics</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-medium">Requirement Gathering</span></td>
              <td className="py-3 px-3 font-mono font-bold">Rs. 1,15,00,000</td>
              <td className="py-3 px-3"><span className="text-amber-600 font-bold">40%</span></td>
              <td className="py-3 px-3 text-slate-500">Sep 15, 2026</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // 7. Product Catalogue Mock
  if (module === MODULE_KEYS.PRODUCT_CATALOGUE || module === "catalogue") {
    return (
      <div className="space-y-4 text-left font-sans">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-64 h-8 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center px-3 text-slate-400 text-xs">
              <Search size={14} className="mr-2" /> Search SKU or product name...
            </div>
            <div className="h-8 px-3 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center text-slate-500 text-xs gap-1.5">
              <Filter size={13} /> Category: All Industrial
            </div>
          </div>
          <div className="h-8 px-3.5 bg-[var(--primary)] text-white font-bold rounded-lg flex items-center text-xs gap-1">
            <Plus size={14} /> Add Product SKU
          </div>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
              <th className="py-2.5 px-3">SKU / Code</th>
              <th className="py-2.5 px-3">Product Description & Specs</th>
              <th className="py-2.5 px-3">Category</th>
              <th className="py-2.5 px-3">Unit Price (INR)</th>
              <th className="py-2.5 px-3">Applicable Tax Rate</th>
              <th className="py-2.5 px-3">Inventory Status</th>
              <th className="py-2.5 px-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-350">
            <tr>
              <td className="py-3 px-3 font-bold font-mono text-slate-800 dark:text-slate-200">PRD-IND-001</td>
              <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">High-Precision Rotary Valve 50mm Stainless</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">Industrial Valves</span></td>
              <td className="py-3 px-3 font-mono font-bold">Rs. 14,500.00</td>
              <td className="py-3 px-3">18% Standard GST</td>
              <td className="py-3 px-3"><span className="text-emerald-600 font-bold">In Stock (240 Units)</span></td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Active</span></td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold font-mono text-slate-800 dark:text-slate-200">PRD-IND-004</td>
              <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">Hydraulic Actuator Assembly Heavy Duty</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">Hydraulics</span></td>
              <td className="py-3 px-3 font-mono font-bold">Rs. 38,000.00</td>
              <td className="py-3 px-3">18% Standard GST</td>
              <td className="py-3 px-3"><span className="text-amber-600 font-bold">Low Stock (12 Units)</span></td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Active</span></td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold font-mono text-slate-800 dark:text-slate-200">PRD-ELC-012</td>
              <td className="py-3 px-3 font-semibold text-slate-800 dark:text-slate-200">Programmable Logic Controller X20 Series</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">Automation</span></td>
              <td className="py-3 px-3 font-mono font-bold">Rs. 62,400.00</td>
              <td className="py-3 px-3">18% Standard GST</td>
              <td className="py-3 px-3"><span className="text-emerald-600 font-bold">In Stock (85 Units)</span></td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Active</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // 8. Settings & Master Config Mock (For WhatsApp Templates, Sample Config, Approval Matrix, Tax Master, Loss Reasons, Notification Rules, Custom Fields, Pipeline Stages)
  if (
    module === MODULE_KEYS.MANAGER_DASHBOARD ||
    module === "settings" ||
    (typeof module === "string" && module.includes("settings")) ||
    variantMin === 2
  ) {
    return (
      <div className="space-y-4 text-left font-sans">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">System Configuration &amp; Master Rules</h4>
            <p className="text-[11px] text-slate-400 mt-0.5">Manage automated rules, master data tables, and approval thresholds</p>
          </div>
          <div className="h-8 px-3.5 bg-[var(--primary)] text-white font-bold rounded-lg flex items-center text-xs gap-1">
            <Plus size={14} /> Add New Rule / Config
          </div>
        </div>
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
              <th className="py-2.5 px-3">Configuration Rule / Master Name</th>
              <th className="py-2.5 px-3">Rule Code / ID</th>
              <th className="py-2.5 px-3">Applies To / Workflow Scope</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3">Last Updated By</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-350">
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-500" /> Standard GST 18% (Inter-State IGST)</td>
              <td className="py-3 px-3 font-mono">TAX_RULE_18_IGST</td>
              <td className="py-3 px-3">All Commercial Invoices &amp; Quotations</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span></td>
              <td className="py-3 px-3 text-slate-400">Jul 14, 2026 by Admin</td>
              <td className="py-3 px-3 text-right"><span className="text-[var(--primary)] font-bold">Edit Rule</span></td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><ShieldCheck size={15} className="text-blue-500" /> Level 2 Discount Matrix (&gt; 10% Margin)</td>
              <td className="py-3 px-3 font-mono">APP_MATRIX_L2</td>
              <td className="py-3 px-3">Sales Executive &amp; Manager Quotations</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span></td>
              <td className="py-3 px-3 text-slate-400">Jul 10, 2026 by Admin</td>
              <td className="py-3 px-3 text-right"><span className="text-[var(--primary)] font-bold">Edit Rule</span></td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><ShieldCheck size={15} className="text-purple-500" /> WhatsApp Deal Stage Progression Notice</td>
              <td className="py-3 px-3 font-mono">WA_TMPL_STAGE</td>
              <td className="py-3 px-3">Auto-triggered on Deal Stage Transition</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span></td>
              <td className="py-3 px-3 text-slate-400">Jun 28, 2026 by Admin</td>
              <td className="py-3 px-3 text-right"><span className="text-[var(--primary)] font-bold">Edit Rule</span></td>
            </tr>
            <tr>
              <td className="py-3 px-3 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2"><ShieldCheck size={15} className="text-amber-500" /> Mandatory Loss Reason - Competitor Price</td>
              <td className="py-3 px-3 font-mono">LOSS_RSN_04</td>
              <td className="py-3 px-3">Opportunity Marked Lost Workflow</td>
              <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Active</span></td>
              <td className="py-3 px-3 text-slate-400">Jun 15, 2026 by Admin</td>
              <td className="py-3 px-3 text-right"><span className="text-[var(--primary)] font-bold">Edit Rule</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }

  // 9. Default Generic List / Summary Mock (Fallback for any other module)
  return (
    <div className="space-y-4 text-left font-sans">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Active Records</p>
          <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">48</p>
          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">+12% this month</p>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Avg Turnaround Time</p>
          <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">1.4 Days</p>
          <p className="text-[10px] text-blue-600 font-semibold mt-0.5">SLA Target &lt; 2.0 Days</p>
        </div>
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Process Efficiency</p>
          <p className="text-xl font-extrabold text-slate-800 dark:text-slate-100 mt-1">96.2%</p>
          <p className="text-[10px] text-emerald-600 font-semibold mt-0.5">Optimized workflow</p>
        </div>
      </div>
      <table className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-semibold">
            <th className="py-2.5 px-3">Reference Code</th>
            <th className="py-2.5 px-3">Entity / Customer Description</th>
            <th className="py-2.5 px-3">Assigned Owner</th>
            <th className="py-2.5 px-3">Turnaround / SLA</th>
            <th className="py-2.5 px-3">Status</th>
            <th className="py-2.5 px-3">Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-600 dark:text-slate-350">
          <tr>
            <td className="py-3 px-3 font-bold font-mono text-slate-800 dark:text-slate-200">REF-2026-0841</td>
            <td className="py-3 px-3 font-medium">Enterprise Supply Agreement Rollout</td>
            <td className="py-3 px-3">Sandhiya Suresh</td>
            <td className="py-3 px-3 font-mono">1.2 Days</td>
            <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Completed</span></td>
            <td className="py-3 px-3 text-slate-400">Today, 11:30 AM</td>
          </tr>
          <tr>
            <td className="py-3 px-3 font-bold font-mono text-slate-800 dark:text-slate-200">REF-2026-0839</td>
            <td className="py-3 px-3 font-medium">Annual Procurement Tender Discussion</td>
            <td className="py-3 px-3">Rahul Verma</td>
            <td className="py-3 px-3 font-mono">2.5 Days</td>
            <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700">In Progress</span></td>
            <td className="py-3 px-3 text-slate-400">Yesterday</td>
          </tr>
          <tr>
            <td className="py-3 px-3 font-bold font-mono text-slate-800 dark:text-slate-200">REF-2026-0822</td>
            <td className="py-3 px-3 font-medium">Technical Specification Review &amp; Approval</td>
            <td className="py-3 px-3">Priya Sharma</td>
            <td className="py-3 px-3 font-mono">0.8 Days</td>
            <td className="py-3 px-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700">Approved</span></td>
            <td className="py-3 px-3 text-slate-400">Jul 19, 2026</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Wraps children. If the current user's company has the module,
 * renders children normally. If not, renders a blurred static mock preview
 * with a centered, non-interactive pill badge.
 *
 * Usage:
 * <ModuleGate module={MODULE_KEYS.COMPETITORS}>
 *   <CompetitorIntelligenceTab ... />
 * </ModuleGate>
 */
export function ModuleGate({
  module,
  variantMin,
  children,
  fallback,
}: {
  module?: ModuleKey;
  variantMin?: number;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { user } = useAuth();

  const subject: ModuleCheckSubject = {
    companyId: (user as any)?.companyId ?? user?.company?.id ?? null,
    variant: user?.variant || user?.company?.variant || 1,
    enabledModules: user?.enabledModules ?? user?.company?.enabledModules ?? null,
  };

  // If a specific module key is provided, check it via hasModule
  if (module && hasModule(subject, module)) {
    return <>{children}</>;
  }
  
  // If no module key but a variantMin is provided, check variant directly
  if (!module && variantMin !== undefined && (subject.variant ?? 1) >= variantMin) {
    return <>{children}</>;
  }

  if (fallback) return <>{fallback}</>;

  const minRequired = module ? getMinimumVariantForModule(module) : (variantMin ?? 1);
  const label = module ? (MODULE_LABELS[module] ?? module) : `Variant ${variantMin}`;

  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 w-full min-h-[300px] shadow-sm my-4">
      {/* Blurred background mock content - pointer events disabled */}
      <div className="filter blur-[6px] pointer-events-none select-none opacity-80 p-6 transition-all duration-300">
        {renderMockContent(module, variantMin)}
      </div>

      {/* Centered Lock Badge Overlay - completely non-interactive */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/15 dark:bg-slate-950/35 backdrop-blur-[1px] p-4 select-none">
        <div className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-slate-900 dark:bg-slate-800 text-white shadow-2xl border border-slate-700/60 transform -translate-y-1">
          <Lock size={16} className="text-amber-400 shrink-0" />
          <span className="text-sm font-bold tracking-wide">
            Included in Variant {minRequired}
          </span>
        </div>
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2.5 px-3 py-1 rounded-md bg-white/90 dark:bg-slate-900/90 shadow-sm border border-slate-200/60 dark:border-slate-800">
          {label} Module
        </p>
      </div>
    </div>
  );
}

/**
 * For collapsible sections — shows the header (title + icon) so the user
 * knows the feature exists, but the body is a blurred static mock preview.
 *
 * Usage:
 * <LockedSection title="Competitor Intelligence" icon={<Swords size={15} />} moduleKey={MODULE_KEYS.COMPETITORS}>
 *   <CompetitorIntelligenceTab ... />
 * </LockedSection>
 */
export function LockedSection({
  title,
  subtitle,
  icon,
  moduleKey,
  children,
  defaultOpen = false,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  moduleKey: ModuleKey;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const { user } = useAuth();

  const subject: ModuleCheckSubject = {
    companyId: (user as any)?.companyId ?? user?.company?.id ?? null,
    variant: user?.variant || user?.company?.variant || 1,
    enabledModules: user?.enabledModules ?? user?.company?.enabledModules ?? null,
  };

  if (hasModule(subject, moduleKey)) {
    return (
      <CollapsibleSection
        title={title}
        subtitle={subtitle}
        icon={icon}
        defaultOpen={defaultOpen}
        bodyClassName="pt-4"
      >
        {children}
      </CollapsibleSection>
    );
  }

  const minRequired = getMinimumVariantForModule(moduleKey);
  const label = MODULE_LABELS[moduleKey] ?? moduleKey;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-950 shadow-sm my-4">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
        {icon}
        <div>
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
            {title}
            <Lock size={14} className="text-amber-500" />
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      <div className="relative overflow-hidden w-full min-h-[240px]">
        {/* Blurred background mock content - pointer events disabled */}
        <div className="filter blur-[6px] pointer-events-none select-none opacity-80 p-6 transition-all duration-300">
          {renderMockContent(moduleKey)}
        </div>

        {/* Centered Lock Badge Overlay - completely non-interactive */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/15 dark:bg-slate-950/35 backdrop-blur-[1px] p-4 select-none">
          <div className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-slate-900 dark:bg-slate-800 text-white shadow-2xl border border-slate-700/60 transform -translate-y-1">
            <Lock size={16} className="text-amber-400 shrink-0" />
            <span className="text-sm font-bold tracking-wide">
              Included in Variant {minRequired}
            </span>
          </div>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-2.5 px-3 py-1 rounded-md bg-white/90 dark:bg-slate-900/90 shadow-sm border border-slate-200/60 dark:border-slate-800">
            {label} Module
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook for use in client components to check module access.
 * Returns a function: const hasMod = useHasModule(); hasMod(MODULE_KEYS.X)
 */
export function useHasModule() {
  const { user } = useAuth();

  const companyId = (user as any)?.companyId ?? user?.company?.id ?? null;
  const variant = user?.variant || user?.company?.variant || 1;
  const enabledModulesStr = JSON.stringify(user?.enabledModules ?? user?.company?.enabledModules ?? null);

  return useCallback((moduleKey: ModuleKey) => {
    const enabledModules = JSON.parse(enabledModulesStr);
    const subject: ModuleCheckSubject = {
      companyId,
      variant,
      enabledModules,
    };
    return hasModule(subject, moduleKey);
  }, [companyId, variant, enabledModulesStr]);
}

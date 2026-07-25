"use client";

import { useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { useAuth } from "@/components/AuthProvider";
import { CRMSpinner } from "@/components/CRMSpinner";
import {
  BarChart3, TrendingUp, PieChart, Activity, FileText, Clock, CheckCircle,
  AlertCircle, Download, ArrowRight, Users, ShoppingBag, Stethoscope, Gavel,
  PackageCheck, Target, Swords, Trophy, CalendarDays, Phone, MapPin,
} from "lucide-react";

interface ReportCard {
  href: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  variant: "orange" | "dark" | "light" | "blue" | "green" | "amber" | "indigo";
}

function ReportsDirectoryContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const variant = user?.variant || user?.company?.variant || 1;
  const isVariant2 = variant >= 2;
  const isVariant3 = variant >= 3;
  const isVariant4 = variant >= 4;

  // Backwards-compat: redirect legacy ?type= links to dedicated pages
  useEffect(() => {
    const type = searchParams.get("type");
    if (type === "lead") {
      router.replace("/reports/leads");
    } else if (type === "followup") {
      router.replace("/reports/followups");
    }
  }, [searchParams, router]);

  const reports: ReportCard[] = [
    ...(isVariant2 ? [
      { href: "/reports/leads", title: "Lead Report", description: "Lead pipeline, sources, status distribution & conversion", icon: <FileText size={22} />, category: "Pipeline", variant: "orange" as const },
      { href: "/reports/followups", title: "Follow-Up Report", description: "Follow-up activities, overdue tasks & team productivity", icon: <Phone size={22} />, category: "Pipeline", variant: "dark" as const },
      { href: "/reports/opportunities", title: "Opportunity Report", description: "Open opportunities, stage distribution & weighted pipeline value", icon: <TrendingUp size={22} />, category: "Pipeline", variant: "light" as const },
      { href: "/reports/rfq", title: "RFQ Report", description: "RFQ pipeline, costing status & quotation conversion", icon: <ShoppingBag size={22} />, category: "Sales", variant: "blue" as const },
      { href: "/reports/quotations", title: "Quotation Report", description: "Quotation performance, acceptance rates & revenue", icon: <CheckCircle size={22} />, category: "Sales", variant: "green" as const },
      { href: "/reports/sales-performance", title: "Sales Performance", description: "Per-executive KPIs: leads, calls, meetings, deals & revenue", icon: <Users size={22} />, category: "Sales", variant: "indigo" as const },
      { href: "/reports/visits", title: "Visit Report", description: "Customer visit tracking, coverage & outcomes", icon: <MapPin size={22} />, category: "Sales", variant: "amber" as const },
      { href: "/reports/forecast", title: "Forecast Report", description: "Target vs achievement forecasting & pipeline projection", icon: <CalendarDays size={22} />, category: "Sales", variant: "dark" as const },
    ] : []),
    ...(isVariant3 ? [
      { href: "/reports/samples", title: "Sample Report", description: "Sample dispatch tracking, conversion & outstanding balances", icon: <Stethoscope size={22} />, category: "Operations", variant: "light" as const },
      { href: "/reports/negotiations", title: "Negotiation Report", description: "Negotiation outcomes, discount trends & closure analysis", icon: <Gavel size={22} />, category: "Operations", variant: "orange" as const },
    ] : []),
    ...(isVariant4 ? [
      { href: "/reports/purchase-orders", title: "Purchase Order Report", description: "PO lifecycle, approval status & ERP sync tracking", icon: <PackageCheck size={22} />, category: "Operations", variant: "blue" as const },
      { href: "/reports/po-conversion", title: "PO Conversion Report", description: "Deal-to-PO conversion rates & value analysis", icon: <BarChart3 size={22} />, category: "Operations", variant: "green" as const },
      { href: "/reports/competitor-analysis", title: "Competitor Analysis", description: "Win/loss analysis, competitor positioning & market share", icon: <Swords size={22} />, category: "Intelligence", variant: "indigo" as const },
      { href: "/reports/target-achievement", title: "Target Achievement", description: "Sales target vs achievement with executive breakdown", icon: <Target size={22} />, category: "Intelligence", variant: "amber" as const },
    ] : []),
  ];

  // Group by category
  const categories = Array.from(new Set(reports.map(r => r.category)));
  const reportsByCategory = categories.map(cat => ({
    category: cat,
    items: reports.filter(r => r.category === cat),
  }));

  const variantColorMap: Record<string, string> = {
    orange: "bg-[var(--accent)] text-[var(--accent-contrast)]",
    dark: "bg-slate-900 text-white",
    light: "bg-rose-50 text-rose-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    indigo: "bg-indigo-50 text-indigo-600",
  };

  return (
    <PageShell
      title="Reports"
      subtitle="Analytics and business intelligence — select a report to view details"
      breadcrumb={[{ label: "Dashboard", href: "/dashboard" }, { label: "Reports" }]}
    >
      <PageContainer className="space-y-8 p-0">
        {reports.length === 0 ? (
          <div className="crm-card p-12 text-center">
            <PieChart size={40} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm font-bold text-slate-500">No reports available for your current plan.</p>
            <p className="text-xs text-slate-400 mt-1">Contact your administrator to enable reporting features.</p>
          </div>
        ) : (
          reportsByCategory.map(({ category, items }) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{category} Reports</h3>
                <span className="text-[10px] font-bold text-slate-300 bg-slate-100 px-2 py-0.5 rounded-full">{items.length}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {items.map(report => (
                  <Link
                    key={report.href}
                    href={report.href}
                    className="crm-card p-5 group hover:-translate-y-1 hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[170px] cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${variantColorMap[report.variant]}`}>
                        {report.icon}
                      </div>
                      <ArrowRight size={16} className="text-slate-300 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                    </div>
                    <div className="mt-4">
                      <h4 className="text-sm font-bold text-slate-800 group-hover:text-slate-900">{report.title}</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">{report.description}</p>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--accent)] group-hover:gap-2 transition-all">
                        Read Report <ArrowRight size={12} />
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))
        )}
      </PageContainer>
    </PageShell>
  );
}

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-12"><CRMSpinner size={36} label="Loading report..." /></div>}>
      <ReportsDirectoryContent />
    </Suspense>
  );
}

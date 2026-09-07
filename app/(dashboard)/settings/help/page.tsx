"use client";

import { useMemo, useState, useEffect } from "react";
import { useAuth } from "@/components/AuthProvider";
import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { helpArticles, rankArticles, groupBySection, type HelpArticle } from "@/lib/helpArticles";
import {
  Search,
  ArrowLeft,
  HelpCircle,
  AlertTriangle,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import * as LucideIcons from "lucide-react";
import { cn } from "@/lib/ui-utils";

const SECTION_ICONS: Record<string, keyof typeof LucideIcons> = {
  Dashboard: "LayoutDashboard",
  Leads: "Users",
  Accounts: "Building2",
  Contacts: "Contact",
  Activities: "ListTodo",
  "Customer Visits": "MapPin",
  "Product Catalogue": "Package",
  "Sales Pipeline": "TrendingUp",
  RFQ: "FileQuestion",
  Quotations: "FileText",
  Tasks: "CheckSquare",
  "Follow Ups": "PhoneCall",
  Reports: "BarChart3",
  "User Management": "UserCog",
  Settings: "Settings",
};

const SECTION_COLORS: Record<string, string> = {
  Overview: "bg-blue-500/10 text-blue-600",
  CRM: "bg-indigo-500/10 text-indigo-600",
  Operations: "bg-amber-500/10 text-amber-600",
  Product: "bg-emerald-500/10 text-emerald-600",
  Sales: "bg-rose-500/10 text-rose-600",
  Reports: "bg-purple-500/10 text-purple-600",
  Administration: "bg-slate-500/10 text-slate-600",
};

const SHAPED_EMAIL = "shahnaz@sukisoftware.com";

type SectionItem = HelpArticle | HelpArticle["submodules"][number];

function SectionCard({
  article,
  onClick,
}: {
  article: (typeof helpArticles)[number];
  onClick: () => void;
}) {
  const iconName = SECTION_ICONS[article.title] || "BookOpen";
  const Icon = LucideIcons[iconName] as React.ComponentType<{ size?: number; className?: string }>;
  const color = SECTION_COLORS[article.section] || "bg-[var(--primary)]/10 text-[var(--primary)]";

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 hover:border-[var(--primary)]/40 hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      <div className="flex items-start gap-4">
        <div className={cn("shrink-0 w-11 h-11 rounded-xl flex items-center justify-center", color)}>
          {Icon ? <Icon size={20} /> : <BookOpen size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-slate-800">{article.title}</h3>
            <ChevronRight
              size={18}
              className="text-slate-300 group-hover:text-[var(--primary)] transition-colors"
            />
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{article.route}</p>
          <p className="text-sm text-slate-500 mt-2 line-clamp-2">{article.summary}</p>
        </div>
      </div>
    </button>
  );
}

function ArticleRow({
  article,
  onClick,
}: {
  article: (typeof helpArticles)[number];
  onClick: () => void;
}) {
  const iconName = SECTION_ICONS[article.title] || "BookOpen";
  const Icon = LucideIcons[iconName] as React.ComponentType<{ size?: number; className?: string }>;
  const color = SECTION_COLORS[article.section] || "bg-[var(--primary)]/10 text-[var(--primary)]";

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5 hover:border-[var(--primary)]/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start gap-4">
        <div className={cn("shrink-0 w-11 h-11 rounded-xl flex items-center justify-center", color)}>
          {Icon ? <Icon size={20} /> : <BookOpen size={20} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-800">{article.title}</h3>
            {article.partial && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                <AlertTriangle size={10} />
                Partially Available
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 line-clamp-2">{article.summary}</p>
          <p className="text-xs text-slate-400 mt-1">{article.section} · {article.route}</p>
        </div>
        <ChevronRight
          size={18}
          className="text-slate-300 group-hover:text-[var(--primary)] transition-colors mt-2"
        />
      </div>
    </button>
  );
}

function DocPanel({ item }: { item: SectionItem }) {
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">{item.title}</h2>
          <p className="text-xs text-slate-500 mt-0.5">{item.route}</p>
        </div>
        {item.partial ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
            <AlertTriangle size={12} />
            Partially Available
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
            Available
          </span>
        )}
      </div>

      {"partialNote" in item && item.partialNote && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          {item.partialNote}
        </div>
      )}

      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-2">Summary</h3>
        <p className="text-sm text-slate-600 leading-relaxed">{item.summary}</p>
      </div>

      <div>
        <h3 className="text-sm font-bold text-slate-800 mb-2">Workflow steps</h3>
        <ol className="space-y-2">
          {item.steps.map((step, idx) => (
            <li
              key={idx}
              className="text-sm text-slate-600 leading-relaxed flex gap-3"
            >
              <span className="shrink-0 w-5 h-5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] text-xs font-semibold flex items-center justify-center">
                {idx + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      {item.screenshot && (
        <div>
          <h3 className="text-sm font-bold text-slate-800 mb-2">Screenshot</h3>
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.screenshot}
              alt={`${item.title} screenshot`}
              className="w-full h-auto max-w-[1120px] mx-auto"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = "none";
                const next = target.nextElementSibling as HTMLElement | null;
                if (next) next.style.display = "flex";
              }}
            />
            <div
              className="hidden min-h-[160px] items-center justify-center text-sm text-slate-400 p-6"
              aria-hidden="true"
            >
              Screenshot not available
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HelpCenterPage() {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  const canAccess =
    user?.email?.toLowerCase() === SHAPED_EMAIL || user?.role === "SuperAdmin";

  const selected = useMemo(
    () => helpArticles.find((a) => a.id === selectedId) || null,
    [selectedId],
  );

  useEffect(() => {
    if (selected) {
      setActiveSectionId(selected.id);
    }
  }, [selected]);

  const { activeItem, activeIsParent } = useMemo(() => {
    if (!selected) return { activeItem: null, activeIsParent: false };
    const isParent = activeSectionId === selected.id;
    const item = isParent
      ? selected
      : selected.submodules.find((s) => s.id === activeSectionId) || selected;
    return { activeItem: item, activeIsParent: isParent };
  }, [selected, activeSectionId]);

  const ranked = useMemo(() => rankArticles(query), [query]);
  const grouped = useMemo(() => groupBySection(ranked), [ranked]);

  if (!canAccess) {
    return (
      <PageShell title="Help Center" subtitle="User manual & module guidance">
        <PageContainer className="space-y-6 p-0">
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6 text-center">
            <HelpCircle size={40} className="mx-auto text-slate-300 mb-3" />
            <h2 className="text-base font-bold text-slate-800 mb-1">
              Help Center is not available for this account
            </h2>
            <p className="text-sm text-slate-500">
              This module is configured for the Shahnaz administrator account.
            </p>
          </div>
        </PageContainer>
      </PageShell>
    );
  }

  if (selected && activeItem) {
    const sectionItems: { id: string; title: string; route: string; isParent: boolean }[] = [
      { id: selected.id, title: selected.title, route: selected.route, isParent: true },
      ...selected.submodules.map((s) => ({ id: s.id, title: s.title, route: s.route, isParent: false })),
    ];

    return (
      <PageShell
        title={activeItem.title}
        subtitle={`${selected.section} · ${activeItem.route}`}
      >
        <PageContainer className="space-y-6 p-0">
          <button
            onClick={() => {
              setSelectedId(null);
              setActiveSectionId(null);
            }}
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--primary)] hover:underline"
          >
            <ArrowLeft size={16} />
            Back to Help Center
          </button>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left navigation */}
            <div className="lg:col-span-1 space-y-2">
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  {selected.title} sections
                </h3>
                <div className="space-y-1.5 max-h-[70vh] overflow-y-auto pr-1">
                  {sectionItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setActiveSectionId(item.id)}
                      className={cn(
                        "w-full text-left px-3.5 py-2.5 rounded-lg text-sm transition-all",
                        activeSectionId === item.id
                          ? "bg-[var(--primary)]/10 text-[var(--primary)] font-semibold border border-[var(--primary)]/20"
                          : "text-slate-600 hover:bg-slate-50 border border-transparent",
                      )}
                    >
                      <span className="block truncate">{item.title}</span>
                      <span className="block text-[10px] text-slate-400 truncate mt-0.5">
                        {item.isParent ? selected.route : item.route}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right content */}
            <div className="lg:col-span-3">
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
                    <BookOpen size={18} className="text-slate-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-800">
                      {activeIsParent ? selected.title : "Submodule guide"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {activeIsParent
                        ? `Overview of ${selected.title}`
                        : `Part of ${selected.title}`}
                    </p>
                  </div>
                </div>
                <div className="p-6">
                  <DocPanel item={activeItem} />
                </div>
              </div>
            </div>
          </div>
        </PageContainer>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Help Center"
      subtitle="Searchable user manual for every Shahnaz CRM module"
    >
      <PageContainer className="space-y-6 p-0">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by module, keyword, or route..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
            />
          </div>
        </div>

        {query ? (
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {ranked.length} result{ranked.length === 1 ? "" : "s"} for “{query}”
            </p>
            {ranked.map((article) => (
              <ArticleRow
                key={article.id}
                article={article}
                onClick={() => setSelectedId(article.id)}
              />
            ))}
            {ranked.length === 0 && (
              <div className="text-center py-12 text-slate-400 text-sm">
                No matching topics found.
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([section, articles]) => (
              <div key={section}>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  {section}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {articles.map((article) => (
                    <SectionCard
                      key={article.id}
                      article={article}
                      onClick={() => setSelectedId(article.id)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </PageContainer>
    </PageShell>
  );
}

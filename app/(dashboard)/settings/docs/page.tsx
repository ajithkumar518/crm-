import { PageShell } from "@/components/ui/PageShell";
import PageContainer from "@/components/PageContainer";
import { BookOpen, FileText, CircleHelp, ArrowRight } from "lucide-react";

export default function DocsSettingsPage() {
  return (
    <PageShell
      title="Docs"
      subtitle="User manual and end-to-end workflow guide for Shahnaz CRM."
    >
      <PageContainer className="space-y-6 p-0">
        {/* Intro */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <BookOpen size={18} className="text-slate-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">
              Welcome to Shahnaz CRM
            </h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            Shahnaz CRM is an enterprise CRM application built for manufacturing
            and B2B sales teams. It covers the complete customer lifecycle — from
            capturing a lead, qualifying it, converting to an account and
            opportunity, running technical evaluations, creating quotations, and
            closing the deal.
          </p>
          <p className="text-sm text-slate-600 leading-relaxed mt-3">
            This module is your single place to understand how the project works,
            how each screen connects to the next, and how your team is expected to
            use the system day-to-day.
          </p>
        </div>

        {/* End-to-end flow */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <ArrowRight size={18} className="text-slate-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">
              End-to-End Process Flow
            </h2>
          </div>
          <div className="p-6 space-y-6 text-sm text-slate-700">
            <p>
              The standard Variant 2 Professional CRM flow traces a single
              industrial deal — a customer inquiry for machined / engineered
              components — through every module from lead capture to quotation
              acceptance.
            </p>

            <Phase title="Phase 1: Lead Capture &amp; Qualification">
              <Step>1. Lead is created (via website form, email, or manual entry).</Step>
              <Step>2. First contact is logged as an Activity; a Follow Up is scheduled.</Step>
              <Step>3. BANT qualification (Budget, Authority, Need, Timeline) is completed and the Lead is marked as a Sales Qualified Lead (SQL).</Step>
            </Phase>

            <Phase title="Phase 2: Conversion to Account, Contact &amp; Opportunity">
              <Step>4. The qualified Lead is converted in one action — creating the Account, primary Contact, and Opportunity.</Step>
              <Step>5. Additional stakeholders (e.g. technical, purchase, management contacts) are mapped to the same Account.</Step>
            </Phase>

            <Phase title="Phase 3: Technical Evaluation">
              <Step>6. Internal Tasks are created for the Applications Engineer to prepare a technical fitment proposal.</Step>
              <Step>7. A Customer Visit is planned and completed (with mobile check-in) for site surveys.</Step>
              <Step>8. Technical discussions and meetings are logged under Activities.</Step>
            </Phase>

            <Phase title="Phase 4: Formal RFQ &amp; Costing">
              <Step>9. A Request for Quote (RFQ) is raised when the customer needs formal costing.</Step>
              <Step>10. The costing team reviews materials, machining, and other inputs before the quote is approved internally.</Step>
            </Phase>

            <Phase title="Phase 5: Quotation, Approval &amp; Acceptance">
              <Step>11. A Quotation is generated from the opportunity or RFQ, including line items, taxes, and terms.</Step>
              <Step>12. Discounts or special terms go through the Approval Matrix if configured.</Step>
              <Step>13. The customer accepts the Quotation, and the Opportunity is marked Won.</Step>
            </Phase>
          </div>
        </div>

        {/* Modules reference */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <FileText size={18} className="text-slate-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Module Guide</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <Module title="Leads" text="Capture, qualify, and convert prospect inquiries. Includes BANT checklist, SQL status, and lead-source tracking." />
            <Module title="Accounts" text="Manage customer companies, segment by status, and link all related contacts and opportunities." />
            <Module title="Contacts" text="Maintain people records under each account — technical, purchase, finance, and management contacts." />
            <Module title="Activities" text="Log calls, meetings, emails, WhatsApp messages, notes, and technical discussions." />
            <Module title="Tasks" text="Assign and track internal to-dos with due dates, status, and ownership." />
            <Module title="Customer Visits" text="Plan field visits, capture mobile check-ins, and record visit outcomes." />
            <Module title="Sales Pipeline" text="Track opportunities through stages from qualification to won / lost." />
            <Module title="RFQ" text="Raise, cost, and track customer requests for formal quotes." />
            <Module title="Quotations" text="Create, send, and manage customer quotations and proforma invoices." />
            <Module title="Follow Ups" text="Schedule and complete follow-up actions so no prospect goes cold." />
            <Module title="Product Catalogue" text="Manage categories, products, specifications, datasheets, and brochures." />
            <Module title="Documents" text="Store drawings, NDAs, agreements, and other account-related files." />
            <Module title="Approvals" text="Route quotations, discounts, and negotiations through approval hierarchies." />
            <Module title="Reports" text="Analyse leads, follow-ups, opportunities, quotations, and more." />
            <Module title="Competitors" text="Track competitor products, win/loss analysis, and lost-deal reasons." />
            <Module title="Settings" text="Configure lead sources, email templates, pipeline stages, notification rules, WhatsApp templates, product categories, roles, and permissions." />
          </div>
        </div>

        {/* Help / reference */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center">
              <CircleHelp size={18} className="text-slate-600" />
            </div>
            <h2 className="text-base font-bold text-slate-800">Need More Help?</h2>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">
            The complete project documentation is maintained alongside the
            codebase:
          </p>
          <ul className="mt-3 space-y-2 text-sm text-slate-600 list-disc list-inside">
            <li>
              <span className="font-medium text-slate-800">CRM_Variant2_Professional_BRD.docx</span> — business requirements and module definitions.
            </li>
            <li>
              <span className="font-medium text-slate-800">CRM_Variant2_EndToEnd_Flow.docx</span> — detailed end-to-end process flow with automation, notifications, and database tables.
            </li>
          </ul>
          <p className="text-sm text-slate-600 leading-relaxed mt-3">
            Contact your system administrator if you need access to these files
            or want to request additional documentation in this Docs module.
          </p>
        </div>
      </PageContainer>
    </PageShell>
  );
}

function Phase({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-bold text-slate-800 mb-2">{title}</h3>
      <div className="space-y-1.5 pl-3 border-l-2 border-slate-200">
        {children}
      </div>
    </div>
  );
}

function Step({ children }: { children: React.ReactNode }) {
  return (
    <p className="pl-3 text-slate-600 leading-relaxed">{children}</p>
  );
}

function Module({ title, text }: { title: string; text: string }) {
  return (
    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
      <h4 className="font-semibold text-slate-800 mb-1">{title}</h4>
      <p className="text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}

/**
 * Canonical Navigation Configuration
 * 
 * Single source of truth for navigation search and sidebar.
 * This consolidates navigation data from layout.tsx and variantModuleMap.ts.
 */

export interface NavItem {
  key: string;
  label: string;
  href: string;
  iconEmoji: string;
  keywords: string[];
  type: 'module' | 'submodule' | 'setting';
  parentLabel?: string;
  parentKey?: string;
  variantMin?: number;
  requiredRoles?: string[];
}

// ─── Old-name aliases for backward compatibility ─────────────────────────────────────

export const OLD_NAME_ALIASES: Record<string, string> = {
  'task': 'tasks',
  'todo': 'tasks',
  'visit': 'visits',
  'customer visit': 'visits',
  'deal': 'pipeline',
  'opportunity': 'pipeline',
  'quote': 'quotations',
  'quotation': 'quotations',
  'po': 'purchase-orders',
  'purchase order': 'purchase-orders',
  'rfq': 'rfq',
  'request for quote': 'rfq',
  'sample': 'samples',
  'followup': 'follow-ups',
  'follow-up': 'follow-ups',
  'follow up': 'follow-ups',
};

// ─── V1 base items ────────────────────────────────────────────────────────────

export const V1_ITEMS: NavItem[] = [
  // Modules
  { key: 'dashboard', label: 'Dashboard', href: '/dashboard', iconEmoji: '📊', keywords: ['home', 'overview', 'kpi'], type: 'module' },
  { key: 'leads', label: 'Leads', href: '/leads', iconEmoji: '👤', keywords: ['lead', 'prospect'], type: 'module' },
  { key: 'accounts', label: 'Accounts', href: '/customer-master', iconEmoji: '🏢', keywords: ['customer', 'account', 'company'], type: 'module' },
  { key: 'contacts', label: 'Contacts', href: '/contacts', iconEmoji: '📋', keywords: ['contact', 'person', 'people'], type: 'module' },
  { key: 'activities', label: 'Activities', href: '/activities', iconEmoji: '📞', keywords: ['call', 'meeting', 'email', 'note', 'log'], type: 'module' },
  { key: 'pipeline', label: 'Sales Pipeline', href: '/sales-pipeline/pipeline-list', iconEmoji: '📈', keywords: ['deal', 'opportunity', 'pipeline'], type: 'module' },
  { key: 'quotations', label: 'Quotations', href: '/quotations', iconEmoji: '💰', keywords: ['quote', 'quotation', 'proposal'], type: 'module' },
  { key: 'tasks', label: 'Tasks', href: '/tasks', iconEmoji: '✅', keywords: ['task', 'todo', 'pending'], type: 'module' },
  { key: 'follow-ups', label: 'Follow Ups', href: '/follow-up', iconEmoji: '🔔', keywords: ['follow', 'followup', 'reminder'], type: 'module' },
  { key: 'reports', label: 'Reports', href: '/reports', iconEmoji: '📑', keywords: ['report', 'analytics', 'export'], type: 'module' },
  // Sub-modules
  { key: 'leads-all', label: 'Overview', href: '/leads', iconEmoji: '👤', keywords: ['all leads', 'leads list'], type: 'submodule', parentLabel: 'Leads', parentKey: 'leads' },
  { key: 'leads-new', label: 'New Leads', href: '/leads?status=New', iconEmoji: '👤', keywords: ['new lead', 'add lead'], type: 'submodule', parentLabel: 'Leads', parentKey: 'leads' },
  { key: 'leads-followup', label: "Today's Follow-up", href: '/leads?status=TodaysFollowUp', iconEmoji: '👤', keywords: ['followup today', 'due today'], type: 'submodule', parentLabel: 'Leads', parentKey: 'leads' },
  { key: 'leads-sql', label: 'SQL', href: '/leads?status=SQL', iconEmoji: '👤', keywords: ['sql', 'sales qualified', 'qualified'], type: 'submodule', parentLabel: 'Leads', parentKey: 'leads' },
  { key: 'leads-lost', label: 'Lost Leads', href: '/leads?status=Lost', iconEmoji: '👤', keywords: ['lost', 'lost lead'], type: 'submodule', parentLabel: 'Leads', parentKey: 'leads' },
  { key: 'accounts-all', label: 'Overview', href: '/customer-master', iconEmoji: '🏢', keywords: ['all accounts', 'accounts list'], type: 'submodule', parentLabel: 'Accounts', parentKey: 'accounts' },
  { key: 'accounts-active', label: 'Active Accounts', href: '/customer-master?status=ActiveCustomer', iconEmoji: '🏢', keywords: ['active', 'customer'], type: 'submodule', parentLabel: 'Accounts', parentKey: 'accounts' },
  { key: 'contacts-all', label: 'Overview', href: '/contacts', iconEmoji: '📋', keywords: ['all contacts', 'contacts list'], type: 'submodule', parentLabel: 'Contacts', parentKey: 'contacts' },
  // Activities sub-modules
  { key: 'activities-calls', label: 'Calls', href: '/activities?type=Call', iconEmoji: '📞', keywords: ['call', 'phone'], type: 'submodule', parentLabel: 'Activities', parentKey: 'activities' },
  { key: 'activities-meetings', label: 'Meetings', href: '/activities?type=Meeting', iconEmoji: '📞', keywords: ['meeting', 'schedule'], type: 'submodule', parentLabel: 'Activities', parentKey: 'activities' },
  { key: 'activities-emails', label: 'Emails', href: '/activities?type=Email', iconEmoji: '📞', keywords: ['email', 'mail'], type: 'submodule', parentLabel: 'Activities', parentKey: 'activities' },
  { key: 'activities-notes', label: 'Notes', href: '/activities?type=Note', iconEmoji: '📞', keywords: ['note', 'memo'], type: 'submodule', parentLabel: 'Activities', parentKey: 'activities' },
  // Tasks sub-modules
  { key: 'tasks-all', label: 'Overview', href: '/tasks', iconEmoji: '✅', keywords: ['all tasks', 'tasks list'], type: 'submodule', parentLabel: 'Tasks', parentKey: 'tasks' },
  { key: 'tasks-pending', label: 'Pending', href: '/tasks?status=Pending', iconEmoji: '✅', keywords: ['pending', 'todo'], type: 'submodule', parentLabel: 'Tasks', parentKey: 'tasks' },
  { key: 'tasks-completed', label: 'Completed', href: '/tasks?status=Done', iconEmoji: '✅', keywords: ['completed', 'done'], type: 'submodule', parentLabel: 'Tasks', parentKey: 'tasks' },
  { key: 'tasks-overdue', label: 'Overdue', href: '/tasks?status=Overdue', iconEmoji: '✅', keywords: ['overdue', 'late'], type: 'submodule', parentLabel: 'Tasks', parentKey: 'tasks' },
  // Follow Ups sub-modules
  { key: 'follow-ups-all', label: 'Overview', href: '/follow-up', iconEmoji: '🔔', keywords: ['all follow ups', 'followups list'], type: 'submodule', parentLabel: 'Follow Ups', parentKey: 'follow-ups' },
  { key: 'follow-ups-pending', label: 'Pending', href: '/follow-up?status=Pending', iconEmoji: '🔔', keywords: ['pending', 'due'], type: 'submodule', parentLabel: 'Follow Ups', parentKey: 'follow-ups' },
  { key: 'follow-ups-completed', label: 'Completed', href: '/follow-up?status=Completed', iconEmoji: '🔔', keywords: ['completed', 'done'], type: 'submodule', parentLabel: 'Follow Ups', parentKey: 'follow-ups' },
  { key: 'follow-ups-overdue', label: 'Overdue', href: '/follow-up?status=Overdue', iconEmoji: '🔔', keywords: ['overdue', 'late'], type: 'submodule', parentLabel: 'Follow Ups', parentKey: 'follow-ups' },
  // Pipeline sub-modules
  { key: 'pipeline-all', label: 'Overview', href: '/sales-pipeline/pipeline-list', iconEmoji: '📈', keywords: ['all opportunities', 'pipeline list'], type: 'submodule', parentLabel: 'Sales Pipeline', parentKey: 'pipeline' },
  { key: 'pipeline-qualified', label: 'Qualified', href: '/sales-pipeline/pipeline-list?stage=Qualified', iconEmoji: '📈', keywords: ['qualified', 'sql'], type: 'submodule', parentLabel: 'Sales Pipeline', parentKey: 'pipeline' },
  { key: 'pipeline-rg', label: 'Requirement Gathering', href: '/sales-pipeline/pipeline-list?stage=RequirementGathering', iconEmoji: '📈', keywords: ['requirement', 'gathering', 'rg'], type: 'submodule', parentLabel: 'Sales Pipeline', parentKey: 'pipeline' },
  { key: 'pipeline-meeting', label: 'Meeting Scheduled', href: '/sales-pipeline/pipeline-list?stage=MeetingScheduled', iconEmoji: '📈', keywords: ['meeting', 'scheduled'], type: 'submodule', parentLabel: 'Sales Pipeline', parentKey: 'pipeline' },
  { key: 'pipeline-technical', label: 'Technical Discussion', href: '/sales-pipeline/pipeline-list?stage=TechnicalDiscussion', iconEmoji: '📈', keywords: ['technical', 'discussion'], type: 'submodule', parentLabel: 'Sales Pipeline', parentKey: 'pipeline' },
  { key: 'pipeline-demo', label: 'Demo Conducted', href: '/sales-pipeline/pipeline-list?stage=DemoConducted', iconEmoji: '📈', keywords: ['demo', 'conducted'], type: 'submodule', parentLabel: 'Sales Pipeline', parentKey: 'pipeline' },
  { key: 'pipeline-demo-accepted', label: 'Demo Accepted', href: '/sales-pipeline/pipeline-list?stage=DemoAccepted', iconEmoji: '📈', keywords: ['demo', 'accepted', 'won'], type: 'submodule', parentLabel: 'Sales Pipeline', parentKey: 'pipeline' },
  { key: 'pipeline-won', label: 'Won', href: '/sales-pipeline/pipeline-list?stage=Won', iconEmoji: '📈', keywords: ['won', 'closed won', 'success'], type: 'submodule', parentLabel: 'Sales Pipeline', parentKey: 'pipeline' },
  { key: 'pipeline-overdue', label: 'Overdue', href: '/sales-pipeline/pipeline-list?stage=overdue', iconEmoji: '📈', keywords: ['overdue', 'stale'], type: 'submodule', parentLabel: 'Sales Pipeline', parentKey: 'pipeline' },
  { key: 'pipeline-lost', label: 'Lost', href: '/sales-pipeline/pipeline-list?stage=Lost', iconEmoji: '📈', keywords: ['lost', 'closed lost'], type: 'submodule', parentLabel: 'Sales Pipeline', parentKey: 'pipeline' },
  { key: 'pipeline-rejected', label: 'Rejected', href: '/sales-pipeline/pipeline-list?stage=Rejected', iconEmoji: '📈', keywords: ['rejected', 'declined'], type: 'submodule', parentLabel: 'Sales Pipeline', parentKey: 'pipeline' },
  // V1 quotations sub-modules
  { key: 'quotations-overview', label: 'Overview', href: '/quotations', iconEmoji: '💰', keywords: ['all quotations', 'overview'], type: 'submodule', parentLabel: 'Quotations', parentKey: 'quotations' },
  { key: 'quotations-draft', label: 'Draft', href: '/quotations?status=Draft', iconEmoji: '💰', keywords: ['draft', 'not sent'], type: 'submodule', parentLabel: 'Quotations', parentKey: 'quotations' },
  { key: 'quotations-sent', label: 'Sent', href: '/quotations?status=Sent', iconEmoji: '💰', keywords: ['sent', 'delivered'], type: 'submodule', parentLabel: 'Quotations', parentKey: 'quotations' },
  { key: 'quotations-accepted', label: 'Accepted', href: '/quotations?status=Accepted', iconEmoji: '💰', keywords: ['accepted', 'won'], type: 'submodule', parentLabel: 'Quotations', parentKey: 'quotations' },
  { key: 'quotations-rejected', label: 'Rejected', href: '/quotations?status=Rejected', iconEmoji: '💰', keywords: ['rejected', 'declined'], type: 'submodule', parentLabel: 'Quotations', parentKey: 'quotations' },
  // Reports sub-modules
  { key: 'reports-leads', label: 'Lead Report', href: '/reports/leads', iconEmoji: '📑', keywords: ['lead', 'prospect'], type: 'submodule', parentLabel: 'Reports', parentKey: 'reports' },
  { key: 'reports-followups', label: 'Follow-Up Report', href: '/reports/followups', iconEmoji: '📑', keywords: ['followup', 'follow-up'], type: 'submodule', parentLabel: 'Reports', parentKey: 'reports' },
  { key: 'reports-opportunities', label: 'Opportunity Report', href: '/reports/opportunities', iconEmoji: '📑', keywords: ['opportunity', 'deal'], type: 'submodule', parentLabel: 'Reports', parentKey: 'reports' },
  { key: 'reports-quotations', label: 'Quotation Report', href: '/reports/quotations', iconEmoji: '📑', keywords: ['quotation', 'quote'], type: 'submodule', parentLabel: 'Reports', parentKey: 'reports' },
  // Settings
  { key: 'settings-users', label: 'Users', href: '/user-master', iconEmoji: '⚙️', keywords: ['user', 'team', 'member'], type: 'setting' },
  { key: 'settings-roles', label: 'Roles & Permissions', href: '/settings/roles', iconEmoji: '⚙️', keywords: ['role', 'permission', 'access'], type: 'setting' },
  { key: 'settings-lead-sources', label: 'Lead Sources', href: '/settings/lead-sources', iconEmoji: '⚙️', keywords: ['source', 'lead source'], type: 'setting' },
  { key: 'settings-email', label: 'Email Templates', href: '/settings/email-templates', iconEmoji: '⚙️', keywords: ['email template', 'template'], type: 'setting' },
];

// ─── V2 extras ────────────────────────────────────────────────────────────────

export const V2_EXTRAS: NavItem[] = [
  { key: 'rfq', label: 'RFQ', href: '/rfq', iconEmoji: '📄', keywords: ['rfq', 'request for quote', 'costing'], type: 'module' , variantMin: 2 },
  { key: 'visits', label: 'Customer Visits', href: '/visits', iconEmoji: '🚗', keywords: ['visit', 'field', 'site visit'], type: 'module' , variantMin: 2 },
  { key: 'catalogue', label: 'Product Catalogue', href: '/catalogue', iconEmoji: '📦', keywords: ['product', 'catalogue', 'catalog'], type: 'module' , variantMin: 2 },
  // V2 leads extras
  { key: 'leads-overdue', label: 'Overdue Leads', href: '/leads?status=Overdue', iconEmoji: '👤', keywords: ['overdue', 'late', 'stale'], type: 'submodule', parentLabel: 'Leads', parentKey: 'leads', variantMin: 2 },
  { key: 'leads-duplicate', label: 'Duplicate Leads', href: '/leads?status=Duplicate', iconEmoji: '👤', keywords: ['duplicate', 'copy'], type: 'submodule', parentLabel: 'Leads', parentKey: 'leads', variantMin: 2 },
  // V2 accounts extras
  { key: 'accounts-prospect', label: 'Prospect Accounts', href: '/customer-master?status=Prospect', iconEmoji: '🏢', keywords: ['prospect', 'potential'], type: 'submodule', parentLabel: 'Accounts', parentKey: 'accounts', variantMin: 2 },
  { key: 'accounts-inactive', label: 'Inactive Accounts', href: '/customer-master?status=Inactive', iconEmoji: '🏢', keywords: ['inactive', 'churned'], type: 'submodule', parentLabel: 'Accounts', parentKey: 'accounts', variantMin: 2 },
  // V2 contacts extras
  { key: 'contacts-technical', label: 'Technical Contacts', href: '/contacts?type=Technical', iconEmoji: '📋', keywords: ['technical', 'engineering'], type: 'submodule', parentLabel: 'Contacts', parentKey: 'contacts', variantMin: 2 },
  { key: 'contacts-purchase', label: 'Purchase Contacts', href: '/contacts?type=Purchase', iconEmoji: '📋', keywords: ['purchase', 'buying'], type: 'submodule', parentLabel: 'Contacts', parentKey: 'contacts', variantMin: 2 },
  // V2 activities extras
  { key: 'activities-whatsapp', label: 'WhatsApp', href: '/activities?type=WhatsApp', iconEmoji: '📞', keywords: ['whatsapp', 'wa'], type: 'submodule', parentLabel: 'Activities', parentKey: 'activities', variantMin: 2 },
  { key: 'timeline', label: 'Timeline', href: '/timeline', iconEmoji: '🕐', keywords: ['timeline', 'history', 'chronological'], type: 'submodule', parentLabel: 'Activities', parentKey: 'activities', variantMin: 2 },
  // V2 visits sub-modules
  { key: 'visits-planned', label: 'Planned Visits', href: '/visits?status=PLANNED', iconEmoji: '🚗', keywords: ['planned', 'scheduled'], type: 'submodule', parentLabel: 'Customer Visits', parentKey: 'visits' , variantMin: 2 },
  { key: 'visits-completed', label: 'Completed Visits', href: '/visits?status=COMPLETED', iconEmoji: '🚗', keywords: ['completed', 'done'], type: 'submodule', parentLabel: 'Customer Visits', parentKey: 'visits' , variantMin: 2 },
  { key: 'visits-missed', label: 'Missed Visits', href: '/visits?status=MISSED', iconEmoji: '🚗', keywords: ['missed', 'no-show'], type: 'submodule', parentLabel: 'Customer Visits', parentKey: 'visits' , variantMin: 2 },
  { key: 'visits-log', label: 'Visit Log', href: '/visits/reports', iconEmoji: '🚗', keywords: ['log', 'report', 'summary'], type: 'submodule', parentLabel: 'Customer Visits', parentKey: 'visits' , variantMin: 2 },
  // V2 catalogue sub-modules
  { key: 'catalogue-categories', label: 'Categories', href: '/catalogue/categories', iconEmoji: '📦', keywords: ['category', 'classification'], type: 'submodule', parentLabel: 'Product Catalogue', parentKey: 'catalogue' , variantMin: 2 },
  { key: 'catalogue-products', label: 'Products', href: '/catalogue/products', iconEmoji: '📦', keywords: ['product', 'item'], type: 'submodule', parentLabel: 'Product Catalogue', parentKey: 'catalogue' , variantMin: 2 },
  { key: 'catalogue-specifications', label: 'Specifications', href: '/catalogue/specifications', iconEmoji: '📦', keywords: ['spec', 'technical'], type: 'submodule', parentLabel: 'Product Catalogue', parentKey: 'catalogue' , variantMin: 2 },
  { key: 'catalogue-datasheets', label: 'Datasheets', href: '/catalogue/datasheets', iconEmoji: '📦', keywords: ['datasheet', 'technical'], type: 'submodule', parentLabel: 'Product Catalogue', parentKey: 'catalogue' , variantMin: 2 },
  { key: 'catalogue-brochures', label: 'Brochures', href: '/catalogue/brochures', iconEmoji: '📦', keywords: ['brochure', 'marketing'], type: 'submodule', parentLabel: 'Product Catalogue', parentKey: 'catalogue' , variantMin: 2 },
  // V2 RFQ sub-modules
  { key: 'rfq-new', label: 'New RFQ', href: '/rfq?status=New', iconEmoji: '📄', keywords: ['new', 'request'], type: 'submodule', parentLabel: 'RFQ', parentKey: 'rfq' , variantMin: 2 },
  { key: 'rfq-review', label: 'Under Review', href: '/rfq?status=UnderReview', iconEmoji: '📄', keywords: ['review', 'pending'], type: 'submodule', parentLabel: 'RFQ', parentKey: 'rfq' , variantMin: 2 },
  { key: 'rfq-costing', label: 'Costing Pending', href: '/rfq?status=CostingPending', iconEmoji: '📄', keywords: ['costing', 'price'], type: 'submodule', parentLabel: 'RFQ', parentKey: 'rfq' , variantMin: 2 },
  { key: 'rfq-quotation', label: 'Quotation Created', href: '/rfq?status=QuotationCreated', iconEmoji: '📄', keywords: ['quotation', 'quote created'], type: 'submodule', parentLabel: 'RFQ', parentKey: 'rfq' , variantMin: 2 },
  { key: 'rfq-closed', label: 'Closed RFQ', href: '/rfq?status=Closed', iconEmoji: '📄', keywords: ['closed', 'completed'], type: 'submodule', parentLabel: 'RFQ', parentKey: 'rfq' , variantMin: 2 },
  // V2 quotations extras
  { key: 'quotations-expired', label: 'Expired', href: '/quotations?status=Expired', iconEmoji: '💰', keywords: ['expired', 'timed out'], type: 'submodule', parentLabel: 'Quotations', parentKey: 'quotations' , variantMin: 2 },
  // V2 tasks cancelled
  { key: 'tasks-cancelled', label: 'Cancelled', href: '/tasks?status=Cancelled', iconEmoji: '✅', keywords: ['cancelled', 'aborted'], type: 'submodule', parentLabel: 'Tasks', parentKey: 'tasks' , variantMin: 2 },
  // V2 follow-ups cancelled
  { key: 'follow-ups-cancelled', label: 'Cancelled', href: '/follow-up?status=Cancelled', iconEmoji: '🔔', keywords: ['cancelled', 'aborted'], type: 'submodule', parentLabel: 'Follow Ups', parentKey: 'follow-ups' , variantMin: 2 },
  // V2 pipeline extras (TechnicalDiscussion & DemoConducted moved to V1 — all variants advance through them)
  // V2 reports extras
  { key: 'reports-rfq', label: 'RFQ Report', href: '/reports/rfq', iconEmoji: '📑', keywords: ['rfq', 'request'], type: 'submodule', parentLabel: 'Reports', parentKey: 'reports' , variantMin: 2 },
  { key: 'reports-visits', label: 'Visit Report', href: '/reports/visits', iconEmoji: '📑', keywords: ['visit', 'field'], type: 'submodule', parentLabel: 'Reports', parentKey: 'reports' , variantMin: 2 },
  // V2 settings
  { key: 'settings-pipeline', label: 'Pipeline Stages', href: '/settings/pipeline-stages', iconEmoji: '⚙️', keywords: ['pipeline stage', 'stage'], type: 'setting' , variantMin: 2 },
  { key: 'settings-notif', label: 'Notification Rules', href: '/settings/notification-rules', iconEmoji: '⚙️', keywords: ['notification', 'alert', 'rule'], type: 'setting' , variantMin: 2 },
  { key: 'settings-whatsapp', label: 'WhatsApp Templates', href: '/settings/whatsapp-templates', iconEmoji: '⚙️', keywords: ['whatsapp', 'wa template'], type: 'setting' , variantMin: 2 },
  { key: 'settings-products', label: 'Product Categories', href: '/settings/product-categories', iconEmoji: '⚙️', keywords: ['product category', 'category'], type: 'setting' , variantMin: 2 },
];

// ─── V3 extras ────────────────────────────────────────────────────────────────

export const V3_EXTRAS: NavItem[] = [
  { key: 'samples', label: 'Samples', href: '/samples', iconEmoji: '🧪', keywords: ['sample', 'test sample', 'sample request'], type: 'module' , variantMin: 3 },
  { key: 'negotiations', label: 'Negotiations', href: '/negotiations', iconEmoji: '🤝', keywords: ['negotiation', 'negotiate', 'deal terms'], type: 'module' , variantMin: 3 },
  { key: 'deals', label: 'Deals', href: '/deals', iconEmoji: '💼', keywords: ['deal', 'contract', 'agreement', 'business'], type: 'module', variantMin: 3 },
  { key: 'purchase-orders', label: 'Purchase Orders', href: '/purchase-orders', iconEmoji: '📋', keywords: ['po', 'purchase order', 'order'], type: 'module', variantMin: 4 },
  { key: 'approvals', label: 'Approval Center', href: '/approvals', iconEmoji: '✔️', keywords: ['approval', 'approve', 'pending approval'], type: 'module' , variantMin: 3 },
  { key: 'documents', label: 'Documents', href: '/documents', iconEmoji: '📄', keywords: ['document', 'file'], type: 'module' , variantMin: 3 },
  // V3 deals sub-modules
  { key: 'deals-overview', label: 'Overview', href: '/deals', iconEmoji: '💼', keywords: ['all deals', 'deals list', 'overview'], type: 'submodule', parentLabel: 'Deals', parentKey: 'deals', variantMin: 3 },
  { key: 'deals-active', label: 'Active Deals', href: '/deals?status=Active', iconEmoji: '💼', keywords: ['active', 'ongoing', 'open deals'], type: 'submodule', parentLabel: 'Deals', parentKey: 'deals', variantMin: 3 },
  { key: 'deals-onhold', label: 'On Hold Deals', href: '/deals?status=OnHold', iconEmoji: '💼', keywords: ['on hold', 'stuck', 'paused'], type: 'submodule', parentLabel: 'Deals', parentKey: 'deals', variantMin: 3 },
  { key: 'deals-won', label: 'Won Deals', href: '/deals?status=Won', iconEmoji: '💼', keywords: ['won', 'closed won', 'success'], type: 'submodule', parentLabel: 'Deals', parentKey: 'deals', variantMin: 3 },
  { key: 'deals-lost', label: 'Lost Deals', href: '/deals?status=Lost', iconEmoji: '💼', keywords: ['lost', 'closed lost', 'failed'], type: 'submodule', parentLabel: 'Deals', parentKey: 'deals', variantMin: 3 },
  // V3 samples sub-modules
  { key: 'samples-new', label: 'New Sample Request', href: '/samples?status=New', iconEmoji: '🧪', keywords: ['new', 'request'], type: 'submodule', parentLabel: 'Samples', parentKey: 'samples' , variantMin: 3 },
  { key: 'samples-review', label: 'Under Review', href: '/samples?status=UnderReview', iconEmoji: '🧪', keywords: ['review', 'pending'], type: 'submodule', parentLabel: 'Samples', parentKey: 'samples' , variantMin: 3 },
  { key: 'samples-sent', label: 'Sent To Customer', href: '/samples?status=SentToCustomer', iconEmoji: '🧪', keywords: ['sent', 'shipped'], type: 'submodule', parentLabel: 'Samples', parentKey: 'samples' , variantMin: 3 },
  { key: 'samples-approved', label: 'Approved', href: '/samples?status=Approved', iconEmoji: '🧪', keywords: ['approved', 'accepted'], type: 'submodule', parentLabel: 'Samples', parentKey: 'samples' , variantMin: 3 },
  { key: 'samples-rejected', label: 'Rejected', href: '/samples?status=Rejected', iconEmoji: '🧪', keywords: ['rejected', 'declined'], type: 'submodule', parentLabel: 'Samples', parentKey: 'samples' , variantMin: 3 },
  { key: 'samples-revision', label: 'Revisions', href: '/samples?status=Revision', iconEmoji: '🧪', keywords: ['revision', 'change'], type: 'submodule', parentLabel: 'Samples', parentKey: 'samples' , variantMin: 3 },
  // V3 negotiations sub-modules
  { key: 'negotiations-active', label: 'Active Negotiation', href: '/negotiations?status=Active', iconEmoji: '🤝', keywords: ['active', 'ongoing'], type: 'submodule', parentLabel: 'Negotiations', parentKey: 'negotiations' , variantMin: 3 },
  { key: 'negotiations-price', label: 'Price Revision', href: '/negotiations?status=PriceRevision', iconEmoji: '🤝', keywords: ['price', 'revision'], type: 'submodule', parentLabel: 'Negotiations', parentKey: 'negotiations' , variantMin: 3 },
  { key: 'negotiations-commercial', label: 'Commercial Discussion', href: '/negotiations?status=CommercialDiscussion', iconEmoji: '🤝', keywords: ['commercial', 'terms'], type: 'submodule', parentLabel: 'Negotiations', parentKey: 'negotiations' , variantMin: 3 },
  { key: 'negotiations-approval', label: 'Pending Approval', href: '/negotiations?status=PendingApproval', iconEmoji: '🤝', keywords: ['approval', 'pending'], type: 'submodule', parentLabel: 'Negotiations', parentKey: 'negotiations' , variantMin: 3 },
  { key: 'negotiations-won', label: 'Won', href: '/negotiations?status=Closed-Success', iconEmoji: '🤝', keywords: ['won', 'successful'], type: 'submodule', parentLabel: 'Negotiations', parentKey: 'negotiations' , variantMin: 3 },
  { key: 'negotiations-lost', label: 'Lost', href: '/negotiations?status=Closed-Failure', iconEmoji: '🤝', keywords: ['lost', 'failed'], type: 'submodule', parentLabel: 'Negotiations', parentKey: 'negotiations' , variantMin: 3 },
  // V3 purchase orders sub-modules
  { key: 'purchase-orders-overview', label: 'Overview', href: '/purchase-orders', iconEmoji: '📋', keywords: ['all purchase orders', 'po list', 'overview'], type: 'submodule', parentLabel: 'Purchase Orders', parentKey: 'purchase-orders' , variantMin: 3 },
  { key: 'purchase-orders-new', label: 'New PO', href: '/purchase-orders?status=New', iconEmoji: '📋', keywords: ['new', 'created'], type: 'submodule', parentLabel: 'Purchase Orders', parentKey: 'purchase-orders' , variantMin: 3 },
  { key: 'purchase-orders-validation', label: 'Under Validation', href: '/purchase-orders?status=UnderValidation', iconEmoji: '📋', keywords: ['validation', 'checking'], type: 'submodule', parentLabel: 'Purchase Orders', parentKey: 'purchase-orders' , variantMin: 3 },
  { key: 'purchase-orders-approved', label: 'Approved PO', href: '/purchase-orders?status=Approved', iconEmoji: '📋', keywords: ['approved', 'confirmed'], type: 'submodule', parentLabel: 'Purchase Orders', parentKey: 'purchase-orders' , variantMin: 3 },
  { key: 'purchase-orders-rejected', label: 'Rejected PO', href: '/purchase-orders?status=Rejected', iconEmoji: '📋', keywords: ['rejected', 'declined'], type: 'submodule', parentLabel: 'Purchase Orders', parentKey: 'purchase-orders' , variantMin: 3 },
  { key: 'purchase-orders-closed', label: 'Closed PO', href: '/purchase-orders?status=Closed', iconEmoji: '📋', keywords: ['closed', 'completed'], type: 'submodule', parentLabel: 'Purchase Orders', parentKey: 'purchase-orders' , variantMin: 3 },
  { key: 'purchase-orders-onhold', label: 'On Hold PO', href: '/purchase-orders?status=OnHold', iconEmoji: '📋', keywords: ['on hold', 'hold', 'paused', 'stuck'], type: 'submodule', parentLabel: 'Purchase Orders', parentKey: 'purchase-orders' , variantMin: 3 },
  // V3 approvals sub-modules
  { key: 'approvals-quotations', label: 'Quotation Approvals', href: '/approvals?type=Quotation', iconEmoji: '✔️', keywords: ['quotation', 'quote'], type: 'submodule', parentLabel: 'Approval Center', parentKey: 'approvals' , variantMin: 3 },
  { key: 'approvals-discount', label: 'Discount Approvals', href: '/approvals?type=Discount', iconEmoji: '✔️', keywords: ['discount', 'percentage'], type: 'submodule', parentLabel: 'Approval Center', parentKey: 'approvals' , variantMin: 3 },
  { key: 'approvals-negotiation', label: 'Negotiation Approvals', href: '/approvals?type=Negotiation', iconEmoji: '✔️', keywords: ['negotiation', 'terms'], type: 'submodule', parentLabel: 'Approval Center', parentKey: 'approvals' , variantMin: 3 },
  { key: 'approvals-po', label: 'PO Approvals', href: '/approvals?type=PO', iconEmoji: '✔️', keywords: ['po', 'purchase order'], type: 'submodule', parentLabel: 'Approval Center', parentKey: 'approvals', variantMin: 4 },
  // V3 documents sub-modules
  { key: 'documents-drawings', label: 'Drawings', href: '/documents?type=Drawing', iconEmoji: '📄', keywords: ['drawing', 'technical'], type: 'submodule', parentLabel: 'Documents', parentKey: 'documents' , variantMin: 3 },
  { key: 'documents-specs', label: 'Technical Specifications', href: '/documents?type=TechnicalSpec', iconEmoji: '📄', keywords: ['spec', 'technical'], type: 'submodule', parentLabel: 'Documents', parentKey: 'documents' , variantMin: 3 },
  { key: 'documents-nda', label: 'NDA', href: '/documents?type=NDA', iconEmoji: '📄', keywords: ['nda', 'confidential'], type: 'submodule', parentLabel: 'Documents', parentKey: 'documents' , variantMin: 3 },
  { key: 'documents-quotations', label: 'Quotations', href: '/documents?type=Quotation', iconEmoji: '📄', keywords: ['quotation', 'quote'], type: 'submodule', parentLabel: 'Documents', parentKey: 'documents' , variantMin: 3 },
  { key: 'documents-agreements', label: 'Agreements', href: '/documents?type=Agreement', iconEmoji: '📄', keywords: ['agreement', 'contract'], type: 'submodule', parentLabel: 'Documents', parentKey: 'documents' , variantMin: 3 },
  { key: 'documents-brochures', label: 'Brochures', href: '/documents?type=Brochure', iconEmoji: '📄', keywords: ['brochure', 'marketing'], type: 'submodule', parentLabel: 'Documents', parentKey: 'documents' , variantMin: 3 },
  // V3 reports extras
  { key: 'reports-negotiations', label: 'Negotiation Report', href: '/reports/negotiations', iconEmoji: '📑', keywords: ['negotiation', 'terms'], type: 'submodule', parentLabel: 'Reports', parentKey: 'reports' , variantMin: 3 },
  // V3 contacts extras
  { key: 'contacts-finance', label: 'Finance Contacts', href: '/contacts?type=Finance', iconEmoji: '📋', keywords: ['finance', 'billing', 'accounting'], type: 'submodule', parentLabel: 'Contacts', parentKey: 'contacts', variantMin: 3 },
  { key: 'contacts-management', label: 'Management Contacts', href: '/contacts?type=Management', iconEmoji: '📋', keywords: ['management', 'executive', 'director'], type: 'submodule', parentLabel: 'Contacts', parentKey: 'contacts', variantMin: 3 },
  // V3 quotations extras
  { key: 'quotations-review', label: 'Under Review', href: '/quotations?status=UnderReview', iconEmoji: '💰', keywords: ['review', 'pending approval'], type: 'submodule', parentLabel: 'Quotations', parentKey: 'quotations', variantMin: 3 },
  // V3 settings
  { key: 'settings-approval', label: 'Approval Matrix', href: '/settings/approval-matrix', iconEmoji: '⚙️', keywords: ['approval', 'approve', 'matrix'], type: 'setting' , variantMin: 3 },
  { key: 'settings-loss', label: 'Loss Reason Master', href: '/settings/loss-reason-master', iconEmoji: '⚙️', keywords: ['loss reason', 'lost reason', 'why lost'], type: 'setting' , variantMin: 3 },
  { key: 'settings-custom', label: 'Custom Fields', href: '/settings/custom-fields', iconEmoji: '⚙️', keywords: ['custom field', 'custom', 'field'], type: 'setting' , variantMin: 3 },
];

// ─── V4 extras ────────────────────────────────────────────────────────────────

export const V4_EXTRAS: NavItem[] = [
  { key: 'competitors', label: 'Competitors', href: '/competitors', iconEmoji: '⚔️', keywords: ['competitor', 'competition', 'rival', 'win loss'], type: 'module' , variantMin: 4 },
  { key: 'key-accounts', label: 'Key Accounts', href: '/key-accounts', iconEmoji: '👑', keywords: ['key account', 'strategic', 'kam'], type: 'module' , variantMin: 4 },
  { key: 'territories', label: 'Territories', href: '/territories', iconEmoji: '🗺️', keywords: ['territory', 'region', 'zone', 'area'], type: 'module' , variantMin: 4 },
  { key: 'targets', label: 'Targets', href: '/targets', iconEmoji: '🏆', keywords: ['target', 'quota', 'achievement'], type: 'module' , variantMin: 4 },
  { key: 'forecast', label: 'Forecasts', href: '/forecast', iconEmoji: '📈', keywords: ['forecast', 'projection', 'target vs achievement'], type: 'module' , variantMin: 4 },
  // V4 competitors sub-modules
  { key: 'competitors-overview', label: 'Overview', href: '/competitors', iconEmoji: '⚔️', keywords: ['all competitors', 'competitors list', 'overview'], type: 'submodule', parentLabel: 'Competitors', parentKey: 'competitors' , variantMin: 4 },
  { key: 'competitors-products', label: 'Competitor Products', href: '/competitors/products', iconEmoji: '⚔️', keywords: ['product', 'offering'], type: 'submodule', parentLabel: 'Competitors', parentKey: 'competitors' , variantMin: 4 },
  { key: 'competitors-lost', label: 'Lost Deals Analysis', href: '/competitors/lost-analysis', iconEmoji: '⚔️', keywords: ['lost', 'analysis', 'win loss'], type: 'submodule', parentLabel: 'Competitors', parentKey: 'competitors' , variantMin: 4 },
  { key: 'competitors-winloss', label: 'Win/Loss Analysis', href: '/competitors/win-loss', iconEmoji: '⚔️', keywords: ['win', 'loss', 'ratio'], type: 'submodule', parentLabel: 'Competitors', parentKey: 'competitors' , variantMin: 4 },
  // V4 key accounts sub-modules
  { key: 'key-accounts-overview', label: 'Overview', href: '/key-accounts', iconEmoji: '👑', keywords: ['all key accounts', 'kam list', 'overview'], type: 'submodule', parentLabel: 'Key Accounts', parentKey: 'key-accounts' , variantMin: 4 },
  { key: 'key-accounts-strategic', label: 'Strategic Accounts', href: '/key-accounts?importance=Critical', iconEmoji: '👑', keywords: ['strategic', 'critical'], type: 'submodule', parentLabel: 'Key Accounts', parentKey: 'key-accounts' , variantMin: 4 },
  { key: 'key-accounts-revenue', label: 'Revenue Potential', href: '/key-accounts/revenue-potential', iconEmoji: '👑', keywords: ['revenue', 'potential', 'pipeline'], type: 'submodule', parentLabel: 'Key Accounts', parentKey: 'key-accounts' , variantMin: 4 },
  { key: 'key-accounts-visits', label: 'Visit Schedule', href: '/key-accounts/visit-schedule', iconEmoji: '👑', keywords: ['visit', 'schedule', 'review'], type: 'submodule', parentLabel: 'Key Accounts', parentKey: 'key-accounts' , variantMin: 4 },
  { key: 'key-accounts-relationships', label: 'Relationship Mapping', href: '/key-accounts/relationships', iconEmoji: '👑', keywords: ['relationship', 'mapping', 'contacts'], type: 'submodule', parentLabel: 'Key Accounts', parentKey: 'key-accounts' , variantMin: 4 },
  // V4 territories sub-modules
  { key: 'territories-overview', label: 'Overview', href: '/territories', iconEmoji: '🗺️', keywords: ['all territories', 'territories list', 'overview'], type: 'submodule', parentLabel: 'Territories', parentKey: 'territories' , variantMin: 4 },
  { key: 'territories-regions', label: 'Regions', href: '/territories?view=regions', iconEmoji: '🗺️', keywords: ['region', 'area'], type: 'submodule', parentLabel: 'Territories', parentKey: 'territories' , variantMin: 4 },
  { key: 'territories-accounts', label: 'Territory Accounts', href: '/territories/accounts', iconEmoji: '🗺️', keywords: ['territory account', 'customer'], type: 'submodule', parentLabel: 'Territories', parentKey: 'territories' , variantMin: 4 },
  { key: 'territories-performance', label: 'Territory Performance', href: '/territories/performance', iconEmoji: '🗺️', keywords: ['performance', 'metrics'], type: 'submodule', parentLabel: 'Territories', parentKey: 'territories' , variantMin: 4 },
  // V4 targets sub-modules
  { key: 'targets-overview', label: 'Overview', href: '/targets', iconEmoji: '🏆', keywords: ['all targets', 'targets list', 'overview'], type: 'submodule', parentLabel: 'Targets', parentKey: 'targets' , variantMin: 4 },
  { key: 'targets-achievement', label: 'Achievement Tracking', href: '/targets/achievement', iconEmoji: '🏆', keywords: ['achievement', 'tracking', 'vs target'], type: 'submodule', parentLabel: 'Targets', parentKey: 'targets' , variantMin: 4 },
  { key: 'targets-new', label: 'Set New Target', href: '/targets/new', iconEmoji: '🏆', keywords: ['new target', 'create target'], type: 'submodule', parentLabel: 'Targets', parentKey: 'targets' , variantMin: 4 },
  // V4 forecast sub-modules
  { key: 'forecast-overview', label: 'Overview', href: '/forecast', iconEmoji: '📈', keywords: ['all forecasts', 'forecast list', 'overview'], type: 'submodule', parentLabel: 'Forecasts', parentKey: 'forecast' , variantMin: 4 },
  { key: 'forecast-vs-achievement', label: 'Target vs Achievement', href: '/forecast/target-vs-achievement', iconEmoji: '📈', keywords: ['target vs achievement', 'comparison'], type: 'submodule', parentLabel: 'Forecasts', parentKey: 'forecast' , variantMin: 4 },
  { key: 'forecast-new', label: 'Add Forecast Entry', href: '/forecast/new', iconEmoji: '📈', keywords: ['new forecast', 'add entry'], type: 'submodule', parentLabel: 'Forecasts', parentKey: 'forecast' , variantMin: 4 },
  // V4 reports extras
  { key: 'reports-competitor', label: 'Competitor Loss Report', href: '/reports/competitor-analysis', iconEmoji: '📑', keywords: ['competitor', 'competition', 'loss report'], type: 'submodule', parentLabel: 'Reports', parentKey: 'reports' , variantMin: 4 },
  { key: 'reports-target', label: 'Target KPI Report', href: '/reports/target-achievement', iconEmoji: '📑', keywords: ['target', 'achievement', 'kpi report'], type: 'submodule', parentLabel: 'Reports', parentKey: 'reports' , variantMin: 4 },
  // V4 settings
  { key: 'settings-territory', label: 'Territories', href: '/settings/territories', iconEmoji: '⚙️', keywords: ['territory', 'region', 'zone'], type: 'setting' , variantMin: 4 },
  { key: 'settings-competitor', label: 'Competitor Master', href: '/settings/competitor-master', iconEmoji: '⚙️', keywords: ['competitor', 'competition', 'rival'], type: 'setting' , variantMin: 4 },
];

// ─── Build complete maps by composing ─────────────────────────────────────────

export const CANONICAL_NAV_MAP: Record<number, NavItem[]> = {
  1: V1_ITEMS,
  2: [...V1_ITEMS, ...V2_EXTRAS],
  3: [...V1_ITEMS, ...V2_EXTRAS, ...V3_EXTRAS],
  4: [...V1_ITEMS, ...V2_EXTRAS, ...V3_EXTRAS, ...V4_EXTRAS],
};

/**
 * Get navigation items for a variant, filtered by user role
 */
export function getNavItems(variant: number, userRole?: string): NavItem[] {
  const items = CANONICAL_NAV_MAP[variant] ?? CANONICAL_NAV_MAP[1];
  
  return items.filter(item => {
    // Skip if variant minimum not met
    if (item.variantMin && variant < item.variantMin) return false;
    
    // Skip if role requirement not met
    if (item.requiredRoles && userRole && !item.requiredRoles.includes(userRole)) return false;
    
    return true;
  });
}

export interface HelpSubmodule {
  id: string;
  title: string;
  route: string;
  summary: string;
  steps: string[];
  keywords: string[];
  screenshot?: string;
  partial: boolean;
  partialNote?: string;
}

export interface HelpArticle {
  id: string;
  section: string;
  title: string;
  route: string;
  summary: string;
  steps: string[];
  keywords: string[];
  screenshot?: string;
  partial: boolean;
  partialNote?: string;
  submodules: HelpSubmodule[];
}

function slugifyRoute(route: string) {
  return route
    .replace(/^\//, "")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/-$/, "") || "home";
}

const SHAPED_CRM_HELP_ARTICLES: Omit<HelpArticle, "screenshot">[] = [
  {
    "id": "dashboard",
    "section": "Overview",
    "title": "Dashboard",
    "route": "/dashboard",
    "summary": "A single-screen view that answers 'What must I work on today?' for sales executives and supervisors. My Dashboard is personal and action-oriented; the Sales Manager Dashboard is a team-wide performance view.",
    "steps": [
      "Log in and land on My Dashboard to see overdue follow-ups, pending RFQs, and quotations expiring today.",
      "Use the date-range and territory filters to change the visible time period.",
      "Click any KPI card to open the corresponding module pre-filtered to that status.",
      "Sales managers can switch to the Sales Manager Dashboard for territory target and win-rate rollups."
    ],
    "keywords": [
      "dashboard",
      "home",
      "kpi",
      "overview",
      "sales manager dashboard"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "dashboard-my",
        "title": "My Dashboard",
        "route": "/dashboard",
        "summary": "A personal, action-oriented dashboard for individual sales executives. It highlights overdue follow-ups, pending RFQs, expiring quotations, and today's priorities.",
        "steps": [
          "Log in to land on My Dashboard.",
          "Review the KPI cards for leads, follow-ups, RFQs, and quotations.",
          "Use the date-range and territory filters to change the time period.",
          "Click any KPI card to open the corresponding module pre-filtered to that status."
        ],
        "keywords": ["my dashboard", "dashboard", "overview", "kpi", "home"],
        "partial": false,
        "screenshot": "/help/dashboard.jpg"
      },
      {
        "id": "dashboard-manager",
        "title": "Sales Manager Dashboard",
        "route": "/dashboard/manager",
        "summary": "A team-wide performance view for sales managers. It shows territory-level targets, win rates, quotation conversion, and overdue pipeline actions across the team.",
        "steps": [
          "Open Dashboards from the sidebar and click Sales Manager Dashboard.",
          "Review territory-wise targets, win rates, and conversion numbers.",
          "Drill into individual sales executive performance.",
          "Use filters to focus on a period, territory, or team."
        ],
        "keywords": ["sales manager dashboard", "manager dashboard", "team dashboard", "targets"],
        "partial": false,
        "screenshot": "/help/dashboard-manager.jpg"
      }
    ]
  },
  {
    "id": "leads",
    "section": "CRM",
    "title": "Leads",
    "route": "/leads",
    "summary": "Capture, qualify, and track every inbound or outbound prospect. Leads move from New → Contacted → SQL → Converted, with automatic duplicate detection and follow-up task creation.",
    "steps": [
      "Click New Lead and enter company, contact person, phone/email, source, and estimated value.",
      "Log the first contact as an Activity and complete the BANT qualification checklist.",
      "Once qualified, mark the lead as SQL (Sales Qualified Lead) and convert it to Account + Contact + Opportunity.",
      "Use the Open/Overdue/Lost filters to prioritise your daily outreach."
    ],
    "keywords": [
      "leads",
      "lead",
      "sql",
      "prospect",
      "new lead",
      "qualify"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "Leads-Overview",
        "title": "Overview",
        "route": "/leads",
        "summary": "Use the Overview view under Leads to work with the related records and status-specific data.",
        "steps": [
          "Open Leads in the sidebar.",
          "Click Overview.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overview",
          "leads",
          "overview",
          "/leads"
        ],
        "screenshot": "/help/leads.jpg",
        "partial": false
      },
      {
        "id": "Leads-New-Leads",
        "title": "New Leads",
        "route": "/leads?status=New",
        "summary": "Use the New Leads filter under Leads to work with the related records and status-specific data.",
        "steps": [
          "Open Leads in the sidebar.",
          "Click New Leads.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "new leads",
          "leads",
          "new leads",
          "/leads",
          "status",
          "New"
        ],
        "screenshot": "/help/leads-status-New.jpg",
        "partial": false
      },
      {
        "id": "Leads-Today-s-Follow-up",
        "title": "Today's Follow-up",
        "route": "/leads?status=TodaysFollowUp",
        "summary": "Use the Today's Follow-up filter under Leads to work with the related records and status-specific data.",
        "steps": [
          "Open Leads in the sidebar.",
          "Click Today's Follow-up.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "today's follow-up",
          "leads",
          "today's follow-up",
          "/leads",
          "status",
          "TodaysFollowUp"
        ],
        "screenshot": "/help/leads-status-TodaysFollowUp.jpg",
        "partial": false
      },
      {
        "id": "Leads-SQL",
        "title": "SQL",
        "route": "/leads?status=SQL",
        "summary": "Use the SQL filter under Leads to work with the related records and status-specific data.",
        "steps": [
          "Open Leads in the sidebar.",
          "Click SQL.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "sql",
          "leads",
          "sql",
          "/leads",
          "status",
          "SQL"
        ],
        "screenshot": "/help/leads-status-SQL.jpg",
        "partial": false
      },
      {
        "id": "Leads-Lost-Leads",
        "title": "Lost Leads",
        "route": "/leads?status=Lost",
        "summary": "Use the Lost Leads filter under Leads to work with the related records and status-specific data.",
        "steps": [
          "Open Leads in the sidebar.",
          "Click Lost Leads.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "lost leads",
          "leads",
          "lost leads",
          "/leads",
          "status",
          "Lost"
        ],
        "screenshot": "/help/leads-status-Lost.jpg",
        "partial": false
      },
      {
        "id": "Leads-Overdue-Leads",
        "title": "Overdue Leads",
        "route": "/leads?status=Overdue",
        "summary": "Use the Overdue Leads filter under Leads to work with the related records and status-specific data.",
        "steps": [
          "Open Leads in the sidebar.",
          "Click Overdue Leads.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overdue leads",
          "leads",
          "overdue leads",
          "/leads",
          "status",
          "Overdue"
        ],
        "screenshot": "/help/leads-status-Overdue.jpg",
        "partial": false
      },
      {
        "id": "Leads-Duplicate-Leads",
        "title": "Duplicate Leads",
        "route": "/leads?status=Duplicate",
        "summary": "Use the Duplicate Leads filter under Leads to work with the related records and status-specific data.",
        "steps": [
          "Open Leads in the sidebar.",
          "Click Duplicate Leads.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "duplicate leads",
          "leads",
          "duplicate leads",
          "/leads",
          "status",
          "Duplicate"
        ],
        "screenshot": "/help/leads-status-Duplicate.jpg",
        "partial": false
      },
      {
        "id": "Leads-Lead-Capture",
        "title": "Lead Capture",
        "route": "/leads/capture",
        "summary": "Use the Lead Capture view under Leads to work with the related records and status-specific data.",
        "steps": [
          "Open Leads in the sidebar.",
          "Click Lead Capture.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "lead capture",
          "leads",
          "lead capture",
          "/leads/capture"
        ],
        "screenshot": "/help/leads-capture.jpg",
        "partial": false
      }
    ]
  },
  {
    "id": "accounts",
    "section": "CRM",
    "title": "Accounts",
    "route": "/customer-master",
    "summary": "Maintain an authoritative record of every customer or prospect organisation, plant locations, GST details, credit terms, and buying history — the anchor entity for Contacts, Opportunities, RFQs, and Quotations.",
    "steps": [
      "Create an Account with name, type, GSTIN, territory, and credit terms.",
      "Add one or more plant locations under the account.",
      "Link purchase, technical, and finance contacts under the Account.",
      "Open the 360° view to see quotations, RFQs, visits, and activities in one place."
    ],
    "keywords": [
      "accounts",
      "customer",
      "customer master",
      "company",
      "organisation",
      "gst"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "Accounts-Overview",
        "title": "Overview",
        "route": "/customer-master",
        "summary": "Use the Overview view under Accounts to work with the related records and status-specific data.",
        "steps": [
          "Open Accounts in the sidebar.",
          "Click Overview.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overview",
          "accounts",
          "overview",
          "/customer-master"
        ],
        "screenshot": "/help/customer-master.jpg",
        "partial": false
      },
      {
        "id": "Accounts-Active-Accounts",
        "title": "Active Accounts",
        "route": "/customer-master?status=ActiveCustomer",
        "summary": "Use the Active Accounts filter under Accounts to work with the related records and status-specific data.",
        "steps": [
          "Open Accounts in the sidebar.",
          "Click Active Accounts.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "active accounts",
          "accounts",
          "active accounts",
          "/customer-master",
          "status",
          "ActiveCustomer"
        ],
        "screenshot": "/help/customer-master-status-ActiveCustomer.jpg",
        "partial": false
      },
      {
        "id": "Accounts-Prospect-Accounts",
        "title": "Prospect Accounts",
        "route": "/customer-master?status=Prospect",
        "summary": "Use the Prospect Accounts filter under Accounts to work with the related records and status-specific data.",
        "steps": [
          "Open Accounts in the sidebar.",
          "Click Prospect Accounts.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "prospect accounts",
          "accounts",
          "prospect accounts",
          "/customer-master",
          "status",
          "Prospect"
        ],
        "screenshot": "/help/customer-master-status-Prospect.jpg",
        "partial": false
      },
      {
        "id": "Accounts-Inactive-Accounts",
        "title": "Inactive Accounts",
        "route": "/customer-master?status=Inactive",
        "summary": "Use the Inactive Accounts filter under Accounts to work with the related records and status-specific data.",
        "steps": [
          "Open Accounts in the sidebar.",
          "Click Inactive Accounts.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "inactive accounts",
          "accounts",
          "inactive accounts",
          "/customer-master",
          "status",
          "Inactive"
        ],
        "screenshot": "/help/customer-master-status-Inactive.jpg",
        "partial": false
      }
    ]
  },
  {
    "id": "contacts",
    "section": "CRM",
    "title": "Contacts",
    "route": "/contacts",
    "summary": "Track every individual stakeholder inside a customer organisation — distinguishing Technical/R&D contacts from Purchase/Finance contacts so the right message reaches the right person.",
    "steps": [
      "Open an Account and add a Contact with designation, department, email, and phone.",
      "Mark the decision-maker or primary contact flags as appropriate.",
      "Log calls, meetings, or emails against the contact from the Activities module.",
      "Use the Technical / Purchase filter to quickly find the right stakeholder."
    ],
    "keywords": [
      "contacts",
      "contact person",
      "stakeholder",
      "decision maker",
      "purchase contact"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "Contacts-Overview",
        "title": "Overview",
        "route": "/contacts",
        "summary": "Use the Overview view under Contacts to work with the related records and status-specific data.",
        "steps": [
          "Open Contacts in the sidebar.",
          "Click Overview.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overview",
          "contacts",
          "overview",
          "/contacts"
        ],
        "screenshot": "/help/contacts.jpg",
        "partial": false
      },
      {
        "id": "Contacts-Technical-Contacts",
        "title": "Technical Contacts",
        "route": "/contacts?type=Technical",
        "summary": "Use the Technical Contacts filter under Contacts to work with the related records and status-specific data.",
        "steps": [
          "Open Contacts in the sidebar.",
          "Click Technical Contacts.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "technical contacts",
          "contacts",
          "technical contacts",
          "/contacts",
          "type",
          "Technical"
        ],
        "screenshot": "/help/contacts-type-Technical.jpg",
        "partial": false
      },
      {
        "id": "Contacts-Purchase-Contacts",
        "title": "Purchase Contacts",
        "route": "/contacts?type=Purchase",
        "summary": "Use the Purchase Contacts filter under Contacts to work with the related records and status-specific data.",
        "steps": [
          "Open Contacts in the sidebar.",
          "Click Purchase Contacts.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "purchase contacts",
          "contacts",
          "purchase contacts",
          "/contacts",
          "type",
          "Purchase"
        ],
        "screenshot": "/help/contacts-type-Purchase.jpg",
        "partial": false
      }
    ]
  },
  {
    "id": "activities",
    "section": "CRM",
    "title": "Activities",
    "route": "/activities",
    "summary": "Log every customer interaction — calls, meetings, emails, WhatsApp messages, notes, and technical discussions — against the relevant lead, account, or opportunity.",
    "steps": [
      "Click Log Activity and choose the activity type (Call, Meeting, Email, WhatsApp, Note).",
      "Link the activity to a Lead, Account, Contact, or Opportunity.",
      "Add notes, outcomes, and the next planned action.",
      "Review the activity timeline on any record to see the full conversation history."
    ],
    "keywords": [
      "activities",
      "calls",
      "meetings",
      "emails",
      "logs",
      "timeline",
      "interactions"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "Activities-Overview",
        "title": "Overview",
        "route": "/activities",
        "summary": "Use the Overview view under Activities to work with the related records and status-specific data.",
        "steps": [
          "Open Activities in the sidebar.",
          "Click Overview.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overview",
          "activities",
          "overview",
          "/activities"
        ],
        "screenshot": "/help/activities.jpg",
        "partial": false
      },
      {
        "id": "Activities-Calls",
        "title": "Calls",
        "route": "/activities?type=Call",
        "summary": "Use the Calls filter under Activities to work with the related records and status-specific data.",
        "steps": [
          "Open Activities in the sidebar.",
          "Click Calls.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "calls",
          "activities",
          "calls",
          "/activities",
          "type",
          "Call"
        ],
        "screenshot": "/help/activities-type-Call.jpg",
        "partial": false
      },
      {
        "id": "Activities-Meetings",
        "title": "Meetings",
        "route": "/activities?type=Meeting",
        "summary": "Use the Meetings filter under Activities to work with the related records and status-specific data.",
        "steps": [
          "Open Activities in the sidebar.",
          "Click Meetings.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "meetings",
          "activities",
          "meetings",
          "/activities",
          "type",
          "Meeting"
        ],
        "screenshot": "/help/activities-type-Meeting.jpg",
        "partial": false
      },
      {
        "id": "Activities-Emails",
        "title": "Emails",
        "route": "/activities?type=Email",
        "summary": "Use the Emails filter under Activities to work with the related records and status-specific data.",
        "steps": [
          "Open Activities in the sidebar.",
          "Click Emails.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "emails",
          "activities",
          "emails",
          "/activities",
          "type",
          "Email"
        ],
        "screenshot": "/help/activities-type-Email.jpg",
        "partial": false
      },
      {
        "id": "Activities-Notes",
        "title": "Notes",
        "route": "/activities?type=Note",
        "summary": "Use the Notes filter under Activities to work with the related records and status-specific data.",
        "steps": [
          "Open Activities in the sidebar.",
          "Click Notes.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "notes",
          "activities",
          "notes",
          "/activities",
          "type",
          "Note"
        ],
        "screenshot": "/help/activities-type-Note.jpg",
        "partial": false
      },
      {
        "id": "Activities-WhatsApp",
        "title": "WhatsApp",
        "route": "/activities?type=WhatsApp",
        "summary": "Use the WhatsApp filter under Activities to work with the related records and status-specific data.",
        "steps": [
          "Open Activities in the sidebar.",
          "Click WhatsApp.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "whatsapp",
          "activities",
          "whats app",
          "/activities",
          "type",
          "WhatsApp"
        ],
        "screenshot": "/help/activities-type-WhatsApp.jpg",
        "partial": false
      },
      {
        "id": "Activities-Timeline",
        "title": "Timeline",
        "route": "/timeline",
        "summary": "Use the Timeline view under Activities to work with the related records and status-specific data.",
        "steps": [
          "Open Activities in the sidebar.",
          "Click Timeline.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "timeline",
          "activities",
          "timeline",
          "/timeline"
        ],
        "screenshot": "/help/timeline.jpg",
        "partial": false
      }
    ]
  },
  {
    "id": "tasks",
    "section": "Operations",
    "title": "Tasks",
    "route": "/tasks",
    "summary": "Assign and track internal to-dos with due dates, status, and ownership. Tasks keep technical reviews, costing inputs, and approvals on schedule.",
    "steps": [
      "Create a Task with title, owner, due date, and priority.",
      "Link it to the relevant Lead, Account, Opportunity, or RFQ.",
      "Update status as Not Started → In Progress → Completed, or reassign if needed.",
      "Use the My Tasks view to see only your assigned work."
    ],
    "keywords": [
      "tasks",
      "todo",
      "to do",
      "work",
      "assigned",
      "internal task"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "Tasks-Overview",
        "title": "Overview",
        "route": "/tasks",
        "summary": "Use the Overview view under Tasks to work with the related records and status-specific data.",
        "steps": [
          "Open Tasks in the sidebar.",
          "Click Overview.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overview",
          "tasks",
          "overview",
          "/tasks"
        ],
        "screenshot": "/help/tasks.jpg",
        "partial": false
      },
      {
        "id": "Tasks-Pending",
        "title": "Pending",
        "route": "/tasks?status=Pending",
        "summary": "Use the Pending filter under Tasks to work with the related records and status-specific data.",
        "steps": [
          "Open Tasks in the sidebar.",
          "Click Pending.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "pending",
          "tasks",
          "pending",
          "/tasks",
          "status",
          "Pending"
        ],
        "screenshot": "/help/tasks-status-Pending.jpg",
        "partial": false
      },
      {
        "id": "Tasks-Completed",
        "title": "Completed",
        "route": "/tasks?status=Done",
        "summary": "Use the Completed filter under Tasks to work with the related records and status-specific data.",
        "steps": [
          "Open Tasks in the sidebar.",
          "Click Completed.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "completed",
          "tasks",
          "completed",
          "/tasks",
          "status",
          "Done"
        ],
        "screenshot": "/help/tasks-status-Done.jpg",
        "partial": false
      },
      {
        "id": "Tasks-Overdue",
        "title": "Overdue",
        "route": "/tasks?status=Overdue",
        "summary": "Use the Overdue filter under Tasks to work with the related records and status-specific data.",
        "steps": [
          "Open Tasks in the sidebar.",
          "Click Overdue.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overdue",
          "tasks",
          "overdue",
          "/tasks",
          "status",
          "Overdue"
        ],
        "screenshot": "/help/tasks-status-Overdue.jpg",
        "partial": false
      },
      {
        "id": "Tasks-Cancelled",
        "title": "Cancelled",
        "route": "/tasks?status=Cancelled",
        "summary": "Use the Cancelled filter under Tasks to work with the related records and status-specific data.",
        "steps": [
          "Open Tasks in the sidebar.",
          "Click Cancelled.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "cancelled",
          "tasks",
          "cancelled",
          "/tasks",
          "status",
          "Cancelled"
        ],
        "screenshot": "/help/tasks-status-Cancelled.jpg",
        "partial": false
      }
    ]
  },
  {
    "id": "follow-ups",
    "section": "Operations",
    "title": "Follow Ups",
    "route": "/follow-up",
    "summary": "Schedule and complete follow-up actions so no prospect goes cold. Follow-ups are created automatically when a Lead is added and can be added manually to any record.",
    "steps": [
      "Create a Follow Up from a Lead, Account, or Opportunity with a due date and reminder.",
      "Use Today / Overdue views to prioritise calls that need immediate attention.",
      "Mark the follow-up as Completed and log the outcome.",
      "Dashboard KPIs will refresh to reflect today's completed and overdue follow-ups."
    ],
    "keywords": [
      "follow ups",
      "followup",
      "reminder",
      "callback",
      "scheduled call"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "Follow-Ups-Overview",
        "title": "Overview",
        "route": "/follow-up",
        "summary": "Use the Overview view under Follow Ups to work with the related records and status-specific data.",
        "steps": [
          "Open Follow Ups in the sidebar.",
          "Click Overview.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overview",
          "follow ups",
          "overview",
          "/follow-up"
        ],
        "screenshot": "/help/follow-up.jpg",
        "partial": false
      },
      {
        "id": "Follow-Ups-Pending",
        "title": "Pending",
        "route": "/follow-up?status=Pending",
        "summary": "Use the Pending filter under Follow Ups to work with the related records and status-specific data.",
        "steps": [
          "Open Follow Ups in the sidebar.",
          "Click Pending.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "pending",
          "follow ups",
          "pending",
          "/follow-up",
          "status",
          "Pending"
        ],
        "screenshot": "/help/follow-up-status-Pending.jpg",
        "partial": false
      },
      {
        "id": "Follow-Ups-Completed",
        "title": "Completed",
        "route": "/follow-up?status=Completed",
        "summary": "Use the Completed filter under Follow Ups to work with the related records and status-specific data.",
        "steps": [
          "Open Follow Ups in the sidebar.",
          "Click Completed.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "completed",
          "follow ups",
          "completed",
          "/follow-up",
          "status",
          "Completed"
        ],
        "screenshot": "/help/follow-up-status-Completed.jpg",
        "partial": false
      },
      {
        "id": "Follow-Ups-Overdue",
        "title": "Overdue",
        "route": "/follow-up?status=Overdue",
        "summary": "Use the Overdue filter under Follow Ups to work with the related records and status-specific data.",
        "steps": [
          "Open Follow Ups in the sidebar.",
          "Click Overdue.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overdue",
          "follow ups",
          "overdue",
          "/follow-up",
          "status",
          "Overdue"
        ],
        "screenshot": "/help/follow-up-status-Overdue.jpg",
        "partial": false
      },
      {
        "id": "Follow-Ups-Quotation",
        "title": "Quotation",
        "route": "/follow-up/quotation",
        "summary": "Use the Quotation view under Follow Ups to work with the related records and status-specific data.",
        "steps": [
          "Open Follow Ups in the sidebar.",
          "Click Quotation.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "quotation",
          "follow ups",
          "quotation",
          "/follow-up/quotation"
        ],
        "screenshot": "/help/follow-up-quotation.jpg",
        "partial": false
      },
      {
        "id": "Follow-Ups-Cancelled",
        "title": "Cancelled",
        "route": "/follow-up?status=Cancelled",
        "summary": "Use the Cancelled filter under Follow Ups to work with the related records and status-specific data.",
        "steps": [
          "Open Follow Ups in the sidebar.",
          "Click Cancelled.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "cancelled",
          "follow ups",
          "cancelled",
          "/follow-up",
          "status",
          "Cancelled"
        ],
        "screenshot": "/help/follow-up-status-Cancelled.jpg",
        "partial": false
      }
    ]
  },
  {
    "id": "customer-visits",
    "section": "Operations",
    "title": "Customer Visits",
    "route": "/visits",
    "summary": "Plan field visits, capture mobile check-ins, and record visit outcomes. Visits are especially important for site surveys and technical discussions in the manufacturing sales cycle.",
    "steps": [
      "Schedule a Visit from the Account or Opportunity with date, attendees, and purpose.",
      "Mark check-in/check-out on the mobile view if visiting the customer location.",
      "Add visit notes and attach site photos or documents.",
      "Review the visit history before the next quotation or negotiation."
    ],
    "keywords": [
      "visits",
      "customer visit",
      "field visit",
      "check in",
      "site survey"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "Customer-Visits-Overview",
        "title": "Overview",
        "route": "/visits",
        "summary": "Use the Overview view under Customer Visits to work with the related records and status-specific data.",
        "steps": [
          "Open Customer Visits in the sidebar.",
          "Click Overview.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overview",
          "customer visits",
          "overview",
          "/visits"
        ],
        "screenshot": "/help/visits.jpg",
        "partial": false
      },
      {
        "id": "Customer-Visits-Planned-Visits",
        "title": "Planned Visits",
        "route": "/visits?status=PLANNED",
        "summary": "Use the Planned Visits filter under Customer Visits to work with the related records and status-specific data.",
        "steps": [
          "Open Customer Visits in the sidebar.",
          "Click Planned Visits.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "planned visits",
          "customer visits",
          "planned visits",
          "/visits",
          "status",
          "PLANNED"
        ],
        "screenshot": "/help/visits-status-PLANNED.jpg",
        "partial": false
      },
      {
        "id": "Customer-Visits-Completed-Visits",
        "title": "Completed Visits",
        "route": "/visits?status=COMPLETED",
        "summary": "Use the Completed Visits filter under Customer Visits to work with the related records and status-specific data.",
        "steps": [
          "Open Customer Visits in the sidebar.",
          "Click Completed Visits.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "completed visits",
          "customer visits",
          "completed visits",
          "/visits",
          "status",
          "COMPLETED"
        ],
        "screenshot": "/help/visits-status-COMPLETED.jpg",
        "partial": false
      },
      {
        "id": "Customer-Visits-Missed-Visits",
        "title": "Missed Visits",
        "route": "/visits?status=MISSED",
        "summary": "Use the Missed Visits filter under Customer Visits to work with the related records and status-specific data.",
        "steps": [
          "Open Customer Visits in the sidebar.",
          "Click Missed Visits.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "missed visits",
          "customer visits",
          "missed visits",
          "/visits",
          "status",
          "MISSED"
        ],
        "screenshot": "/help/visits-status-MISSED.jpg",
        "partial": false
      },
      {
        "id": "Customer-Visits-Visit-Log",
        "title": "Visit Log",
        "route": "/visits/reports",
        "summary": "Use the Visit Log view under Customer Visits to work with the related records and status-specific data.",
        "steps": [
          "Open Customer Visits in the sidebar.",
          "Click Visit Log.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "visit log",
          "customer visits",
          "visit log",
          "/visits/reports"
        ],
        "screenshot": "/help/visits-reports.jpg",
        "partial": false
      }
    ]
  },
  {
    "id": "product-catalogue",
    "section": "Product",
    "title": "Product Catalogue",
    "route": "/catalogue/categories",
    "summary": "Manage product categories, finished products, specifications, datasheets, and brochures so the sales team can attach accurate items to quotations and RFQs.",
    "steps": [
      "Create Product Categories (e.g., Pumps, Valves, Components) to keep the catalogue organised.",
      "Add a Product with name, SKU, specification, unit price, and available datasheets.",
      "Upload brochures and technical drawings so they can be attached to quotations.",
      "Search the catalogue while creating a quotation or RFQ to pick line items quickly."
    ],
    "keywords": [
      "product catalogue",
      "catalogue",
      "products",
      "categories",
      "sku",
      "items"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "Product-Catalogue-Categories",
        "title": "Categories",
        "route": "/catalogue/categories",
        "summary": "Use the Categories view under Product Catalogue to work with the related records and status-specific data.",
        "steps": [
          "Open Product Catalogue in the sidebar.",
          "Click Categories.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "categories",
          "product catalogue",
          "categories",
          "/catalogue/categories"
        ],
        "screenshot": "/help/catalogue-categories.jpg",
        "partial": false
      },
      {
        "id": "Product-Catalogue-Products",
        "title": "Products",
        "route": "/catalogue/products",
        "summary": "Use the Products view under Product Catalogue to work with the related records and status-specific data.",
        "steps": [
          "Open Product Catalogue in the sidebar.",
          "Click Products.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "products",
          "product catalogue",
          "products",
          "/catalogue/products"
        ],
        "screenshot": "/help/catalogue-products.jpg",
        "partial": false
      },
      {
        "id": "Product-Catalogue-Specifications",
        "title": "Specifications",
        "route": "/catalogue/specifications",
        "summary": "Use the Specifications view under Product Catalogue to work with the related records and status-specific data.",
        "steps": [
          "Open Product Catalogue in the sidebar.",
          "Click Specifications.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "specifications",
          "product catalogue",
          "specifications",
          "/catalogue/specifications"
        ],
        "screenshot": "/help/catalogue-specifications.jpg",
        "partial": false
      },
      {
        "id": "Product-Catalogue-Datasheets",
        "title": "Datasheets",
        "route": "/catalogue/datasheets",
        "summary": "Use the Datasheets view under Product Catalogue to work with the related records and status-specific data.",
        "steps": [
          "Open Product Catalogue in the sidebar.",
          "Click Datasheets.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "datasheets",
          "product catalogue",
          "datasheets",
          "/catalogue/datasheets"
        ],
        "screenshot": "/help/catalogue-datasheets.jpg",
        "partial": false
      },
      {
        "id": "Product-Catalogue-Brochures",
        "title": "Brochures",
        "route": "/catalogue/brochures",
        "summary": "Use the Brochures view under Product Catalogue to work with the related records and status-specific data.",
        "steps": [
          "Open Product Catalogue in the sidebar.",
          "Click Brochures.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "brochures",
          "product catalogue",
          "brochures",
          "/catalogue/brochures"
        ],
        "screenshot": "/help/catalogue-brochures.jpg",
        "partial": false
      }
    ]
  },
  {
    "id": "sales-pipeline",
    "section": "Sales",
    "title": "Sales Pipeline",
    "route": "/sales-pipeline/pipeline-list",
    "summary": "Track opportunities through stages from qualification to won/lost. The pipeline gives visibility into expected revenue, stage aging, and what needs to move forward this week.",
    "steps": [
      "Create an Opportunity from a qualified Lead or Account with expected value and close date.",
      "Move the opportunity through stages such as Qualification → Proposal → Negotiation → Won/Lost.",
      "Update stage probability, add next steps, and schedule follow-ups.",
      "Use the Sales Manager Dashboard view to see pipeline value by stage and territory."
    ],
    "keywords": [
      "pipeline",
      "opportunities",
      "sales pipeline",
      "deal",
      "stage",
      "won",
      "lost"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "Sales-Pipeline-Overview",
        "title": "Overview",
        "route": "/sales-pipeline/pipeline-list",
        "summary": "Use the Overview view under Sales Pipeline to work with the related records and status-specific data.",
        "steps": [
          "Open Sales Pipeline in the sidebar.",
          "Click Overview.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overview",
          "sales pipeline",
          "overview",
          "/sales-pipeline/pipeline-list"
        ],
        "screenshot": "/help/sales-pipeline-pipeline-list.jpg",
        "partial": false
      },
      {
        "id": "Sales-Pipeline-Qualified",
        "title": "Qualified",
        "route": "/sales-pipeline/pipeline-list?stage=Qualified",
        "summary": "Use the Qualified filter under Sales Pipeline to work with the related records and status-specific data.",
        "steps": [
          "Open Sales Pipeline in the sidebar.",
          "Click Qualified.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "qualified",
          "sales pipeline",
          "qualified",
          "/sales-pipeline/pipeline-list",
          "stage",
          "Qualified"
        ],
        "screenshot": "/help/sales-pipeline-pipeline-list-stage-Qualified.jpg",
        "partial": false
      },
      {
        "id": "Sales-Pipeline-Requirement-Gathering",
        "title": "Requirement Gathering",
        "route": "/sales-pipeline/pipeline-list?stage=RequirementGathering",
        "summary": "Use the Requirement Gathering filter under Sales Pipeline to work with the related records and status-specific data.",
        "steps": [
          "Open Sales Pipeline in the sidebar.",
          "Click Requirement Gathering.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "requirement gathering",
          "sales pipeline",
          "requirement gathering",
          "/sales-pipeline/pipeline-list",
          "stage",
          "RequirementGathering"
        ],
        "screenshot": "/help/sales-pipeline-pipeline-list-stage-RequirementGathering.jpg",
        "partial": false
      },
      {
        "id": "Sales-Pipeline-Technical-Discussion",
        "title": "Technical Discussion",
        "route": "/sales-pipeline/pipeline-list?stage=TechnicalDiscussion",
        "summary": "Use the Technical Discussion filter under Sales Pipeline to work with the related records and status-specific data.",
        "steps": [
          "Open Sales Pipeline in the sidebar.",
          "Click Technical Discussion.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "technical discussion",
          "sales pipeline",
          "technical discussion",
          "/sales-pipeline/pipeline-list",
          "stage",
          "TechnicalDiscussion"
        ],
        "screenshot": "/help/sales-pipeline-pipeline-list-stage-TechnicalDiscussion.jpg",
        "partial": false
      },
      {
        "id": "Sales-Pipeline-Meeting-Scheduled",
        "title": "Meeting Scheduled",
        "route": "/sales-pipeline/pipeline-list?stage=MeetingScheduled",
        "summary": "Use the Meeting Scheduled filter under Sales Pipeline to work with the related records and status-specific data.",
        "steps": [
          "Open Sales Pipeline in the sidebar.",
          "Click Meeting Scheduled.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "meeting scheduled",
          "sales pipeline",
          "meeting scheduled",
          "/sales-pipeline/pipeline-list",
          "stage",
          "MeetingScheduled"
        ],
        "screenshot": "/help/sales-pipeline-pipeline-list-stage-MeetingScheduled.jpg",
        "partial": false
      },
      {
        "id": "Sales-Pipeline-Demo-Conducted",
        "title": "Demo Conducted",
        "route": "/sales-pipeline/pipeline-list?stage=DemoConducted",
        "summary": "Use the Demo Conducted filter under Sales Pipeline to work with the related records and status-specific data.",
        "steps": [
          "Open Sales Pipeline in the sidebar.",
          "Click Demo Conducted.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "demo conducted",
          "sales pipeline",
          "demo conducted",
          "/sales-pipeline/pipeline-list",
          "stage",
          "DemoConducted"
        ],
        "screenshot": "/help/sales-pipeline-pipeline-list-stage-DemoConducted.jpg",
        "partial": false
      },
      {
        "id": "Sales-Pipeline-Demo-Accepted",
        "title": "Demo Accepted",
        "route": "/sales-pipeline/pipeline-list?stage=DemoAccepted",
        "summary": "Use the Demo Accepted filter under Sales Pipeline to work with the related records and status-specific data.",
        "steps": [
          "Open Sales Pipeline in the sidebar.",
          "Click Demo Accepted.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "demo accepted",
          "sales pipeline",
          "demo accepted",
          "/sales-pipeline/pipeline-list",
          "stage",
          "DemoAccepted"
        ],
        "screenshot": "/help/sales-pipeline-pipeline-list-stage-DemoAccepted.jpg",
        "partial": false
      },
      {
        "id": "Sales-Pipeline-Won",
        "title": "Won",
        "route": "/sales-pipeline/pipeline-list?stage=Won",
        "summary": "Use the Won filter under Sales Pipeline to work with the related records and status-specific data.",
        "steps": [
          "Open Sales Pipeline in the sidebar.",
          "Click Won.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "won",
          "sales pipeline",
          "won",
          "/sales-pipeline/pipeline-list",
          "stage",
          "Won"
        ],
        "screenshot": "/help/sales-pipeline-pipeline-list-stage-Won.jpg",
        "partial": false
      },
      {
        "id": "Sales-Pipeline-Overdue",
        "title": "Overdue",
        "route": "/sales-pipeline/pipeline-list?stage=overdue",
        "summary": "Use the Overdue filter under Sales Pipeline to work with the related records and status-specific data.",
        "steps": [
          "Open Sales Pipeline in the sidebar.",
          "Click Overdue.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overdue",
          "sales pipeline",
          "overdue",
          "/sales-pipeline/pipeline-list",
          "stage",
          "overdue"
        ],
        "screenshot": "/help/sales-pipeline-pipeline-list-stage-overdue.jpg",
        "partial": false
      },
      {
        "id": "Sales-Pipeline-Lost",
        "title": "Lost",
        "route": "/sales-pipeline/pipeline-list?stage=Lost",
        "summary": "Use the Lost filter under Sales Pipeline to work with the related records and status-specific data.",
        "steps": [
          "Open Sales Pipeline in the sidebar.",
          "Click Lost.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "lost",
          "sales pipeline",
          "lost",
          "/sales-pipeline/pipeline-list",
          "stage",
          "Lost"
        ],
        "screenshot": "/help/sales-pipeline-pipeline-list-stage-Lost.jpg",
        "partial": false
      },
      {
        "id": "Sales-Pipeline-Rejected",
        "title": "Rejected",
        "route": "/sales-pipeline/pipeline-list?stage=Rejected",
        "summary": "Use the Rejected filter under Sales Pipeline to work with the related records and status-specific data.",
        "steps": [
          "Open Sales Pipeline in the sidebar.",
          "Click Rejected.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "rejected",
          "sales pipeline",
          "rejected",
          "/sales-pipeline/pipeline-list",
          "stage",
          "Rejected"
        ],
        "screenshot": "/help/sales-pipeline-pipeline-list-stage-Rejected.jpg",
        "partial": false
      }
    ]
  },
  {
    "id": "rfq",
    "section": "Sales",
    "title": "RFQ",
    "route": "/rfq",
    "summary": "Raise, cost, and track customer requests for formal quotes. RFQs feed into the costing/approval workflow before a final quotation is generated.",
    "steps": [
      "Create an RFQ from the Account or Opportunity with required products, quantities, and due date.",
      "Send the RFQ to the costing team and log materials, machining, and other cost inputs.",
      "Review costing output and request internal approval if needed.",
      "Once costed, generate a Quotation directly from the approved RFQ."
    ],
    "keywords": [
      "rfq",
      "request for quote",
      "costing",
      "customer rfq",
      "formal quote"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "RFQ-Overview",
        "title": "Overview",
        "route": "/rfq",
        "summary": "Use the Overview view under RFQ to work with the related records and status-specific data.",
        "steps": [
          "Open RFQ in the sidebar.",
          "Click Overview.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overview",
          "rfq",
          "overview",
          "/rfq"
        ],
        "screenshot": "/help/rfq.jpg",
        "partial": false
      },
      {
        "id": "RFQ-New-RFQ",
        "title": "New RFQ",
        "route": "/rfq?status=New",
        "summary": "Use the New RFQ filter under RFQ to work with the related records and status-specific data.",
        "steps": [
          "Open RFQ in the sidebar.",
          "Click New RFQ.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "new rfq",
          "rfq",
          "new rfq",
          "/rfq",
          "status",
          "New"
        ],
        "screenshot": "/help/rfq-status-New.jpg",
        "partial": false
      },
      {
        "id": "RFQ-Under-Review",
        "title": "Under Review",
        "route": "/rfq?status=UnderReview",
        "summary": "Use the Under Review filter under RFQ to work with the related records and status-specific data.",
        "steps": [
          "Open RFQ in the sidebar.",
          "Click Under Review.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "under review",
          "rfq",
          "under review",
          "/rfq",
          "status",
          "UnderReview"
        ],
        "screenshot": "/help/rfq-status-UnderReview.jpg",
        "partial": false
      },
      {
        "id": "RFQ-Costing-Pending",
        "title": "Costing Pending",
        "route": "/rfq?status=CostingPending",
        "summary": "Use the Costing Pending filter under RFQ to work with the related records and status-specific data.",
        "steps": [
          "Open RFQ in the sidebar.",
          "Click Costing Pending.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "costing pending",
          "rfq",
          "costing pending",
          "/rfq",
          "status",
          "CostingPending"
        ],
        "screenshot": "/help/rfq-status-CostingPending.jpg",
        "partial": false
      },
      {
        "id": "RFQ-Quotation-Created",
        "title": "Quotation Created",
        "route": "/rfq?status=QuotationCreated",
        "summary": "Use the Quotation Created filter under RFQ to work with the related records and status-specific data.",
        "steps": [
          "Open RFQ in the sidebar.",
          "Click Quotation Created.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "quotation created",
          "rfq",
          "quotation created",
          "/rfq",
          "status",
          "QuotationCreated"
        ],
        "screenshot": "/help/rfq-status-QuotationCreated.jpg",
        "partial": false
      },
      {
        "id": "RFQ-Closed-RFQ",
        "title": "Closed RFQ",
        "route": "/rfq?status=Closed",
        "summary": "Use the Closed RFQ filter under RFQ to work with the related records and status-specific data.",
        "steps": [
          "Open RFQ in the sidebar.",
          "Click Closed RFQ.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "closed rfq",
          "rfq",
          "closed rfq",
          "/rfq",
          "status",
          "Closed"
        ],
        "screenshot": "/help/rfq-status-Closed.jpg",
        "partial": false
      }
    ]
  },
  {
    "id": "quotations",
    "section": "Sales",
    "title": "Quotations",
    "route": "/quotations",
    "summary": "Create, send, approve, and manage customer quotations and proforma invoices. Quotations can include line items, taxes, terms, discounts, and PDF attachments.",
    "steps": [
      "Create a Quotation from an Opportunity or RFQ and add line items from the Product Catalogue.",
      "Set taxes, discounts, payment terms, and delivery terms.",
      "Submit for approval if the discount exceeds the allowed threshold.",
      "Send the PDF quotation to one or more recipients (with CC) and track status until accepted."
    ],
    "keywords": [
      "quotations",
      "quote",
      "proforma",
      "pdf",
      "send quotation",
      "customer quote"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "Quotations-Overview",
        "title": "Overview",
        "route": "/quotations",
        "summary": "Use the Overview view under Quotations to work with the related records and status-specific data.",
        "steps": [
          "Open Quotations in the sidebar.",
          "Click Overview.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "overview",
          "quotations",
          "overview",
          "/quotations"
        ],
        "screenshot": "/help/quotations.jpg",
        "partial": false
      },
      {
        "id": "Quotations-Draft",
        "title": "Draft",
        "route": "/quotations?status=Draft",
        "summary": "Use the Draft filter under Quotations to work with the related records and status-specific data.",
        "steps": [
          "Open Quotations in the sidebar.",
          "Click Draft.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "draft",
          "quotations",
          "draft",
          "/quotations",
          "status",
          "Draft"
        ],
        "screenshot": "/help/quotations-status-Draft.jpg",
        "partial": false
      },
      {
        "id": "Quotations-Sent",
        "title": "Sent",
        "route": "/quotations?status=Quotation%20Sent",
        "summary": "Use the Sent filter under Quotations to work with the related records and status-specific data.",
        "steps": [
          "Open Quotations in the sidebar.",
          "Click Sent.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "sent",
          "quotations",
          "sent",
          "/quotations",
          "status",
          "Quotation%20Sent"
        ],
        "screenshot": "/help/quotations-status-Quotation-20Sent.jpg",
        "partial": false
      },
      {
        "id": "Quotations-Accepted",
        "title": "Accepted",
        "route": "/quotations?status=Accepted",
        "summary": "Use the Accepted filter under Quotations to work with the related records and status-specific data.",
        "steps": [
          "Open Quotations in the sidebar.",
          "Click Accepted.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "accepted",
          "quotations",
          "accepted",
          "/quotations",
          "status",
          "Accepted"
        ],
        "screenshot": "/help/quotations-status-Accepted.jpg",
        "partial": false
      },
      {
        "id": "Quotations-Rejected",
        "title": "Rejected",
        "route": "/quotations?status=Rejected",
        "summary": "Use the Rejected filter under Quotations to work with the related records and status-specific data.",
        "steps": [
          "Open Quotations in the sidebar.",
          "Click Rejected.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "rejected",
          "quotations",
          "rejected",
          "/quotations",
          "status",
          "Rejected"
        ],
        "screenshot": "/help/quotations-status-Rejected.jpg",
        "partial": false
      },
      {
        "id": "Quotations-Proforma-Invoices",
        "title": "Proforma Invoices",
        "route": "/proforma-invoices",
        "summary": "Use the Proforma Invoices view under Quotations to work with the related records and status-specific data.",
        "steps": [
          "Open Quotations in the sidebar.",
          "Click Proforma Invoices.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "proforma invoices",
          "quotations",
          "proforma invoices",
          "/proforma-invoices"
        ],
        "screenshot": "/help/proforma-invoices.jpg",
        "partial": false
      },
      {
        "id": "Quotations-Sales-Orders",
        "title": "Sales Orders",
        "route": "/sales-orders",
        "summary": "Use the Sales Orders view under Quotations to work with the related records and status-specific data.",
        "steps": [
          "Open Quotations in the sidebar.",
          "Click Sales Orders.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "sales orders",
          "quotations",
          "sales orders",
          "/sales-orders"
        ],
        "screenshot": "/help/sales-orders.jpg",
        "partial": false
      },
      {
        "id": "Quotations-Expired",
        "title": "Expired",
        "route": "/quotations?status=Expired",
        "summary": "Use the Expired filter under Quotations to work with the related records and status-specific data.",
        "steps": [
          "Open Quotations in the sidebar.",
          "Click Expired.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "expired",
          "quotations",
          "expired",
          "/quotations",
          "status",
          "Expired"
        ],
        "screenshot": "/help/quotations-status-Expired.jpg",
        "partial": false
      }
    ]
  },
  {
    "id": "reports",
    "section": "Reports",
    "title": "Reports",
    "route": "/reports/leads",
    "summary": "Analyse leads, follow-ups, opportunities, quotations, and more with built-in reports and saved filters.",
    "steps": [
      "Choose a report such as Leads, Follow-ups, Pipeline, or Quotations from the sidebar.",
      "Apply filters for date range, territory, owner, status, and product category.",
      "Export the filtered report to Excel for management review.",
      "Save frequently-used filter combinations for quick access later."
    ],
    "keywords": [
      "reports",
      "analytics",
      "excel",
      "filters",
      "saved reports",
      "lead report"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "Reports-Lead-Report",
        "title": "Lead Report",
        "route": "/reports/leads",
        "summary": "Use the Lead Report view under Reports to work with the related records and status-specific data.",
        "steps": [
          "Open Reports in the sidebar.",
          "Click Lead Report.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "lead report",
          "reports",
          "lead report",
          "/reports/leads"
        ],
        "screenshot": "/help/reports-leads.jpg",
        "partial": false
      },
      {
        "id": "Reports-Follow-Up-Report",
        "title": "Follow-Up Report",
        "route": "/reports/followups",
        "summary": "Use the Follow-Up Report view under Reports to work with the related records and status-specific data.",
        "steps": [
          "Open Reports in the sidebar.",
          "Click Follow-Up Report.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "follow-up report",
          "reports",
          "follow-up report",
          "/reports/followups"
        ],
        "screenshot": "/help/reports-followups.jpg",
        "partial": false
      },
      {
        "id": "Reports-Opportunity-Report",
        "title": "Opportunity Report",
        "route": "/reports/opportunities",
        "summary": "Use the Opportunity Report view under Reports to work with the related records and status-specific data.",
        "steps": [
          "Open Reports in the sidebar.",
          "Click Opportunity Report.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "opportunity report",
          "reports",
          "opportunity report",
          "/reports/opportunities"
        ],
        "screenshot": "/help/reports-opportunities.jpg",
        "partial": false
      },
      {
        "id": "Reports-Quotation-Report",
        "title": "Quotation Report",
        "route": "/reports/quotations",
        "summary": "Use the Quotation Report view under Reports to work with the related records and status-specific data.",
        "steps": [
          "Open Reports in the sidebar.",
          "Click Quotation Report.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "quotation report",
          "reports",
          "quotation report",
          "/reports/quotations"
        ],
        "screenshot": "/help/reports-quotations.jpg",
        "partial": false
      },
      {
        "id": "Reports-RFQ-Report",
        "title": "RFQ Report",
        "route": "/reports/rfq",
        "summary": "Use the RFQ Report view under Reports to work with the related records and status-specific data.",
        "steps": [
          "Open Reports in the sidebar.",
          "Click RFQ Report.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "rfq report",
          "reports",
          "rfq report",
          "/reports/rfq"
        ],
        "screenshot": "/help/reports-rfq.jpg",
        "partial": false
      },
      {
        "id": "Reports-Visit-Report",
        "title": "Visit Report",
        "route": "/reports/visits",
        "summary": "Use the Visit Report view under Reports to work with the related records and status-specific data.",
        "steps": [
          "Open Reports in the sidebar.",
          "Click Visit Report.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "visit report",
          "reports",
          "visit report",
          "/reports/visits"
        ],
        "screenshot": "/help/reports-visits.jpg",
        "partial": false
      }
    ]
  },
  {
    "id": "user-management",
    "section": "Administration",
    "title": "User Management",
    "route": "/user-master",
    "summary": "Create and manage CRM users, assign roles, and control permissions. This is an Administration module that controls who can access which screens.",
    "steps": [
      "Navigate to User Management from the sidebar.",
      "Add a new user with name, email, role, and territory.",
      "Assign Roles & Permissions to define module-level access.",
      "Activate or deactivate users as team members join or leave."
    ],
    "keywords": [
      "users",
      "user management",
      "user master",
      "roles",
      "permissions",
      "team"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "User-Management-Users",
        "title": "Users",
        "route": "/user-master",
        "summary": "Use the Users view under User Management to work with the related records and status-specific data.",
        "steps": [
          "Open User Management in the sidebar.",
          "Click Users.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "users",
          "user management",
          "users",
          "/user-master"
        ],
        "screenshot": "/help/user-master.jpg",
        "partial": false
      },
      {
        "id": "User-Management-Roles-Permissions",
        "title": "Roles & Permissions",
        "route": "/settings/roles",
        "summary": "Use the Roles & Permissions view under User Management to work with the related records and status-specific data.",
        "steps": [
          "Open User Management in the sidebar.",
          "Click Roles & Permissions.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "roles & permissions",
          "user management",
          "roles & permissions",
          "/settings/roles"
        ],
        "screenshot": "/help/settings-roles.jpg",
        "partial": false
      }
    ]
  },
  {
    "id": "settings",
    "section": "Administration",
    "title": "Settings",
    "route": "/settings",
    "summary": "Configure the CRM — lead sources, pipeline stages, email templates, WhatsApp templates, notification rules, product categories, tax masters, and approval matrices.",
    "steps": [
      "Open Settings and choose the configuration area from the settings sidebar.",
      "Maintain Lead Sources, Loss Reasons, and Industry Types used across the CRM.",
      "Configure Email and WhatsApp templates for automated notifications.",
      "Set up Roles & Permissions and Approval Matrices to enforce access and discount limits."
    ],
    "keywords": [
      "settings",
      "configuration",
      "lead source",
      "templates",
      "approval",
      "tax master"
    ],
    "partial": false,
    "submodules": [
      {
        "id": "Settings-Lead-Sources",
        "title": "Lead Sources",
        "route": "/settings/lead-sources",
        "summary": "Use the Lead Sources view under Settings to work with the related records and status-specific data.",
        "steps": [
          "Open Settings in the sidebar.",
          "Click Lead Sources.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "lead sources",
          "settings",
          "lead sources",
          "/settings/lead-sources"
        ],
        "screenshot": "/help/settings-lead-sources.jpg",
        "partial": false
      },
      {
        "id": "Settings-Email-Templates",
        "title": "Email Templates",
        "route": "/settings/email-templates",
        "summary": "Use the Email Templates view under Settings to work with the related records and status-specific data.",
        "steps": [
          "Open Settings in the sidebar.",
          "Click Email Templates.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "email templates",
          "settings",
          "email templates",
          "/settings/email-templates"
        ],
        "screenshot": "/help/settings-email-templates.jpg",
        "partial": false
      },

      {
        "id": "Settings-Pipeline-Stages",
        "title": "Pipeline Stages",
        "route": "/settings/pipeline-stages",
        "summary": "Use the Pipeline Stages view under Settings to work with the related records and status-specific data.",
        "steps": [
          "Open Settings in the sidebar.",
          "Click Pipeline Stages.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "pipeline stages",
          "settings",
          "pipeline stages",
          "/settings/pipeline-stages"
        ],
        "screenshot": "/help/settings-pipeline-stages.jpg",
        "partial": false
      },
      {
        "id": "Settings-Notification-Rules",
        "title": "Notification Rules",
        "route": "/settings/notification-rules",
        "summary": "Use the Notification Rules view under Settings to work with the related records and status-specific data.",
        "steps": [
          "Open Settings in the sidebar.",
          "Click Notification Rules.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "notification rules",
          "settings",
          "notification rules",
          "/settings/notification-rules"
        ],
        "screenshot": "/help/settings-notification-rules.jpg",
        "partial": false
      },
      {
        "id": "Settings-WhatsApp-Templates",
        "title": "WhatsApp Templates",
        "route": "/settings/whatsapp-templates",
        "summary": "Use the WhatsApp Templates view under Settings to work with the related records and status-specific data.",
        "steps": [
          "Open Settings in the sidebar.",
          "Click WhatsApp Templates.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "whatsapp templates",
          "settings",
          "whats app templates",
          "/settings/whatsapp-templates"
        ],
        "screenshot": "/help/settings-whatsapp-templates.jpg",
        "partial": false
      },
      {
        "id": "Settings-Product-Categories",
        "title": "Product Categories",
        "route": "/settings/product-categories",
        "summary": "Use the Product Categories view under Settings to work with the related records and status-specific data.",
        "steps": [
          "Open Settings in the sidebar.",
          "Click Product Categories.",
          "Review the records listed for this view.",
          "Use filters, sorting, and action buttons to find and manage entries."
        ],
        "keywords": [
          "product categories",
          "settings",
          "product categories",
          "/settings/product-categories"
        ],
        "screenshot": "/help/settings-product-categories.jpg",
        "partial": false
      }
    ]
  }
];

export const helpArticles: HelpArticle[] = SHAPED_CRM_HELP_ARTICLES.map((a) => ({
  ...a,
  screenshot: `/help/${slugifyRoute(a.route)}.jpg`,
  submodules: a.submodules.map((s) => ({
    ...s,
    screenshot: s.screenshot || `/help/${slugifyRoute(s.route)}.jpg`,
  })),
}));

export function rankArticles(query: string): HelpArticle[] {
  const q = query.trim().toLowerCase();
  if (!q) return helpArticles;

  const scored = helpArticles.map((article) => {
    const hay = {
      title: article.title.toLowerCase(),
      keywords: article.keywords.join(" ").toLowerCase(),
      section: article.section.toLowerCase(),
      route: article.route.toLowerCase(),
      body: `${article.summary} ${article.steps.join(" ")}`.toLowerCase(),
    };

    if (hay.title.includes(q)) return { article, score: 100 };
    if (hay.keywords.includes(q)) return { article, score: 80 };
    if (hay.section.includes(q)) return { article, score: 60 };
    if (hay.route.includes(q)) return { article, score: 40 };
    if (hay.body.includes(q)) return { article, score: 20 };
    return { article, score: 0 };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.article);
}

export function groupBySection(articles: HelpArticle[]) {
  const groups: Record<string, HelpArticle[]> = {};
  for (const article of articles) {
    if (!groups[article.section]) groups[article.section] = [];
    groups[article.section].push(article);
  }
  return groups;
}

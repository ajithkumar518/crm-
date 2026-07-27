// Generates a sample leads Excel file for testing the Import Leads feature.
// Run: node generate-test-leads.js  → produces test-leads.xlsx in project root.
const ExcelJS = require("exceljs");
const path = require("path");

const FIRST_NAMES = ["Ravi","Priya","Karthik","Ananya","Vijay","Meena","Suresh","Divya","Arjun","Lakshmi","Rajesh","Kavita","Mohit","Sneha","Ganesh","Pooja","Naveen","Reshma","Senthil","Bhavana"];
const LAST_NAMES  = ["Kumar","Sharma","Iyer","Reddy","Nair","Menon","Patel","Gupta","Rao","Nair","Subramanian","Krishnan","Pillai","Das","Chandran","Bose","Varma","Joshi"];
const COMPANIES   = ["Apex Industries","BlueWave Tech","Cedar Logistics","Delta Foods","EverGreen Energy","Falcon Automotives","GreenLeaf Pharma","Himalaya Steel","Indus Chemicals","Jupiter Textiles","Kingsley Foods","Lunar Electronics","Maple Plastics","Nova Constructions","Orchid Retail"];
const CITIES      = ["Mumbai","Delhi","Bengaluru","Chennai","Hyderabad","Pune","Kolkata","Ahmedabad","Jaipur","Kochi","Coimbatore","Indore","Lucknow","Surat","Nagpur"];
const INDUSTRIES  = ["Automotive","Manufacturing","IT Services","Healthcare","Retail","Construction","Logistics","Pharmaceuticals","Textiles","Electronics","Chemicals","Food & Beverage","Energy","Plastics","Steel"];
const DESIGNATIONS= ["Purchase Manager","CEO","Procurement Head","Operations Director","VP Sales","GM Operations","Project Manager","Supply Chain Lead","Founder","CTO","Finance Manager","Business Development"];
const STATUSES    = ["New","Contacted","FollowUpDue","SQL","Qualified","Lost"];
const SOURCES     = ["Website","Facebook","Instagram","LinkedIn","Referral","WalkIn","ColdCall","Partner","Trade Show","Tender Portal"];
const BUDGETS     = ["1-5 Lakhs","5-10 Lakhs","10-25 Lakhs","25-50 Lakhs","50 Lakhs - 1 Cr","1-2 Cr","2-5 Cr"];
const TIMELINES   = ["Q1 2026","Q2 2026","Q3 2026","Q4 2026","Immediate","1-3 Months","3-6 Months","6-12 Months"];
const NOTE_SAMPLES= ["Interested in industrial pumps","Followed up after trade show","Needs demo for ERP module","Budget approval pending","Comparison with competitor","Referred by existing client","RFP expected next month","Looking for bulk pricing","Wants site visit","Decision maker on leave"];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randPhone = () => `9${randInt(600000000, 999999999)}`;
const randEmail = (first, last, company) => {
  const dom = company.toLowerCase().replace(/[^a-z]/g, "").slice(0, 8) || "example";
  return `${first.toLowerCase()}.${last.toLowerCase()}@${dom}.com`;
};

const NUM_ROWS = 25;
const headers = [
  "name","phone","email","companyName","designation","city","industryType",
  "leadSource","status","budgetAsked","estimatedValue","timelineAsked",
  "isGenuine","notes","assignedToEmail",
];

const usedEmails = new Set();
const rows = [];
for (let i = 0; i < NUM_ROWS; i++) {
  const first = pick(FIRST_NAMES);
  const last  = pick(LAST_NAMES);
  const company = pick(COMPANIES);
  let email = randEmail(first, last, company);
  while (usedEmails.has(email)) email = `${first.toLowerCase()}.${last.toLowerCase()}${randInt(1,99)}@${company.toLowerCase().replace(/[^a-z]/g,"").slice(0,8)}.com`;
  usedEmails.add(email);

  const estVal = randInt(1, 50) * 100000;
  rows.push([
    `${first} ${last}`,
    randPhone(),
    email,
    company,
    pick(DESIGNATIONS),
    pick(CITIES),
    pick(INDUSTRIES),
    pick(SOURCES),
    pick(STATUSES),
    pick(BUDGETS),
    estVal,
    pick(TIMELINES),
    pick(["yes","no","true","false","1","0"]),
    pick(NOTE_SAMPLES),
    "", // assignedToEmail — leave blank (no real user to assign)
  ]);
}

(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Leads");

  // Header row (bold)
  ws.getRow(1).values = headers;
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).alignment = { horizontal: "center" };

  // Data rows
  rows.forEach((r) => ws.addRow(r));

  // Auto-width columns
  ws.columns.forEach((col, i) => {
    let maxLen = String(headers[i] ?? "").length;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > maxLen) maxLen = len;
    });
    col.width = maxLen + 3;
  });

  // Format estimatedValue column (index 11, 1-based) as number
  ws.getColumn(11).numFmt = "#,##0";

  const outPath = path.join(__dirname, "test-leads.xlsx");
  await wb.xlsx.writeFile(outPath);
  console.log(`Created ${outPath} with ${NUM_ROWS} sample leads.`);
})();

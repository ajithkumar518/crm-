/**
 * Rule-based email classification for SUKI CRM.
 *
 * Categorizes inbound emails as "Enquiry" (customer material enquiries)
 * or "General" (general communication) using keyword matching against
 * the steel/material vocabulary from the Product model and lead source fields.
 *
 * v1: Rule-based keyword approach. No LLM dependency — the codebase has
 * LLM env vars (GEMINI_API_KEY, LLM_API_KEY) but no existing LLM integration
 * pattern is wired up anywhere, so we don't introduce one here.
 */

// Steel/material industry keywords derived from Product model fields:
// materialGrade, materialSize, productType (Black Bar | Bright Bar), rmMake, partNumber
// Plus common enquiry/RFQ terms from the lead intake workflow.
const ENQUIRY_KEYWORDS: string[] = [
  // Requirement/Enquiry terms
  "requirement", "requirements",
  "enquiry", "enquiries", "inquiry", "inquiries",
  "interested", "interested in",
  "looking for",
  // Quotation/Price terms
  "quotation", "quote", "request for quote", "rfq",
  "pricing", "price list", "price quote", "best price", "rate",
  "product inquiry", "product enquiry",
  // Purchase/Procurement terms
  "purchase", "purchase order", "po",
  "procurement", "sourcing", "supplier",
  "bulk order", "bulk enquiry",
  // Sample/Catalogue terms
  "sample request", "send sample",
  "catalogue", "catalog",
  "specification", "spec sheet",
  "MOQ", "minimum order quantity",
  "delivery", "delivery time", "lead time",
  "availability", "in stock",
  // Business terms
  "proposal", "business proposal",
  "collaboration", "partnership",
  "demo request", "schedule a call",
  "please share details", "more information", "more details",
  // Material grades (steel industry - retained for backward compatibility)
  "ss304", "ss316", "ss410", "ss420",
  "en8", "en19", "en24", "en31", "en353", "en36",
  "aisi 304", "aisi 316", "aisi 410", "aisi 420",
  "sa106", "sa516",
  // Material types
  "stainless steel", "mild steel", "carbon steel", "alloy steel",
  "spring steel", "tool steel", "bright bar", "black bar",
  "round bar", "hex bar", "square bar", "flat bar",
  "forging", "casting", "billet", "ingot",
  // Size/quantity terms
  "mm diameter", "mm size", "mm length", "mm thick", "mm width",
  "diameter", "thickness", "length", "width",
  "quantity", "qty", "kgs", "kg", "tons", "tonnes", "mt",
  "pieces", "pcs", "nos", "numbers",
  "moq", "minimum order",
  // RFQ / quotation terms
  "rfq", "quote", "quotation", "quoted",
  "price", "pricing", "rate", "rates",
  "availability", "available", "stock",
  "material required", "material needed", "required material",
  "enquiry", "inquiry", "enquire", "inquire",
  "requirement", "require",
  "supplier", "vendor", "procure", "procurement",
  "delivery", "delivery time", "lead time",
  "specification", "spec", "grade", "make",
  // Lead source terms
  "indiamart", "tradeindia", "justdial",
];

// General communication keywords (strong signals for "General")
const GENERAL_KEYWORDS: string[] = [
  // Exclusion keywords to avoid false leads
  "unsubscribe", "newsletter", "no-reply", "noreply",
  "automated", "notification",
  "promotion", "promotional", "offer expires",
  "invoice", "payment received", "receipt",
  "job application", "resume", "cv attached",
  // General communication
  "thank you", "thanks", "regards", "best regards",
  "meeting", "schedule", "appointment",
  "greeting", "happy birthday", "happy new year", "festival",
  "subscription",
  "out of office", "auto-reply", "autoreply",
  "feedback", "survey",
];

export interface ClassificationResult {
  classification: "Enquiry" | "General";
  confidence: number; // 0.0 - 1.0
  matchedKeywords: string[]; // audit trail
  reason: string; // human-readable explanation
}

/**
 * Classify an email as Enquiry or General based on subject + body content.
 *
 * @param subject Email subject line
 * @param body Email body text (plain text preferred)
 * @returns ClassificationResult with classification, confidence, and audit trail
 */
export function classifyEmail(subject: string, body: string): ClassificationResult {
  const text = `${subject || ""}\n${body || ""}`.toLowerCase();

  const matchedKeywords: string[] = [];
  let enquiryScore = 0;
  let generalScore = 0;

  // Check enquiry keywords
  for (const kw of ENQUIRY_KEYWORDS) {
    if (text.includes(kw)) {
      enquiryScore++;
      matchedKeywords.push(kw);
    }
  }

  // Check general keywords
  const generalMatches: string[] = [];
  for (const kw of GENERAL_KEYWORDS) {
    if (text.includes(kw)) {
      generalScore++;
      generalMatches.push(kw);
    }
  }

  // Determine classification
  const totalScore = enquiryScore + generalScore;
  let classification: "Enquiry" | "General";
  let confidence: number;
  let reason: string;

  if (totalScore === 0) {
    // No keywords matched — default to General with low confidence
    classification = "General";
    confidence = 0.3;
    reason = "No enquiry or general keywords matched. Defaulted to General (low confidence).";
  } else if (enquiryScore > generalScore) {
    classification = "Enquiry";
    confidence = Math.min(0.95, 0.5 + (enquiryScore - generalScore) * 0.15);
    reason = `Matched ${enquiryScore} enquiry keyword(s): ${matchedKeywords.slice(0, 5).join(", ")}${matchedKeywords.length > 5 ? "..." : ""}. General matches: ${generalScore}.`;
  } else if (generalScore > enquiryScore) {
    classification = "General";
    confidence = Math.min(0.95, 0.5 + (generalScore - enquiryScore) * 0.15);
    reason = `Matched ${generalScore} general keyword(s): ${generalMatches.slice(0, 5).join(", ")}${generalMatches.length > 5 ? "..." : ""}. Enquiry matches: ${enquiryScore}.`;
  } else {
    // Tie — lean towards Enquiry since this is a steel CRM and false negatives on enquiries are costly
    classification = "Enquiry";
    confidence = 0.5;
    reason = `Tie at ${enquiryScore} keyword(s) each. Defaulted to Enquiry (steel CRM bias). Enquiry: ${matchedKeywords.slice(0, 3).join(", ")}. General: ${generalMatches.slice(0, 3).join(", ")}.`;
  }

  return {
    classification,
    confidence: Math.round(confidence * 100) / 100,
    matchedKeywords,
    reason,
  };
}

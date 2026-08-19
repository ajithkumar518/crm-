/**
 * Indian GST state code utilities.
 *
 * Under Indian GST law:
 * - Intra-state (supplier state == customer state) → CGST + SGST (each = taxAmount / 2)
 * - Inter-state (supplier state != customer state) → IGST (= full taxAmount)
 *
 * State is determined from the first 2 digits of the GSTIN (GST Identification Number),
 * which is the official state code per the GSTN. This is more reliable than a free-text
 * state field because it is structurally validated at registration time.
 */

/** Map of GST state code (first 2 digits of GSTIN) → state name. */
export const GST_STATE_CODES: Record<string, string> = {
  "01": "Jammu and Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "25": "Daman and Diu",
  "26": "Dadra and Nagar Haveli",
  "27": "Maharashtra",
  "28": "Andhra Pradesh (Old)",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh",
  "97": "Other Territory",
  "99": "Centre Jurisdiction",
};

/**
 * Extract the 2-digit state code from a GSTIN string.
 * Returns null if the GSTIN is missing, too short, or appears to be a
 * placeholder/fabricated value (e.g. "AAAAA0000A" in the PAN segment).
 */
export function getStateCodeFromGstin(gstin: string | null | undefined): string | null {
  if (!gstin) return null;
  const trimmed = gstin.trim().toUpperCase();
  if (trimmed.length < 2) return null;
  const code = trimmed.substring(0, 2);
  if (!GST_STATE_CODES[code]) return null;

  // Placeholder detection: refuse GSTINs with obviously fake PAN segments.
  // A real PAN has 5 letters (positions 3-7 of GSTIN) that are NOT all the same,
  // and 4 digits (positions 8-11) that are NOT all zeros.
  if (trimmed.length >= 15) {
    const panLetters = trimmed.substring(2, 7);
    const panDigits = trimmed.substring(7, 11);
    const allSameLetter = panLetters.split("").every((c) => c === panLetters[0]);
    if (allSameLetter || panDigits === "0000") {
      return null; // Treat placeholder GSTINs as "not configured"
    }
  }

  return code;
}

/**
 * Normalize a free-text state name for comparison.
 * Trims, lowercases, and removes common suffixes/variations.
 */
function normalizeStateName(state: string | null | undefined): string | null {
  if (!state) return null;
  const trimmed = state.trim();
  if (!trimmed) return null;
  return trimmed.toLowerCase().replace(/\s+/g, " ").replace(/\.$/, "");
}

/**
 * Resolve a free-text state name to its GST state code by looking up the
 * GST_STATE_CODES map. Returns null if no match is found.
 */
export function getStateCodeFromName(stateName: string | null | undefined): string | null {
  const normalized = normalizeStateName(stateName);
  if (!normalized) return null;
  for (const [code, name] of Object.entries(GST_STATE_CODES)) {
    if (name.toLowerCase() === normalized) return code;
  }
  // Common abbreviations / partial matches
  const aliases: Record<string, string> = {
    "tamil nadu": "33",
    "tn": "33",
    "kerala": "32",
    "kl": "32",
    "karnataka": "29",
    "ka": "29",
    "maharashtra": "27",
    "mh": "27",
    "mumbai": "27",
    "delhi": "07",
    "new delhi": "07",
    "gujarat": "24",
    "gj": "24",
    "west bengal": "19",
    "wb": "19",
    "kolkata": "19",
    "telangana": "36",
    "ts": "36",
    "hyderabad": "36",
    "andhra pradesh": "37",
    "ap": "37",
    "rajasthan": "08",
    "rj": "08",
    "uttar pradesh": "09",
    "up": "09",
    "punjab": "03",
    "haryana": "06",
    "hr": "06",
    "madhya pradesh": "23",
    "mp": "23",
    "odisha": "21",
    "orissa": "21",
    "assam": "18",
    "bihar": "10",
    "jharkhand": "20",
    "chhattisgarh": "22",
    "cg": "22",
    "goa": "30",
    "himachal pradesh": "02",
    "hp": "02",
    "uttarakhand": "05",
    "uk": "05",
    "sikkim": "11",
    "manipur": "14",
    "mizoram": "15",
    "tripura": "16",
    "meghalaya": "17",
    "nagaland": "13",
    "arunachal pradesh": "12",
    "jammu and kashmir": "01",
    "j&k": "01",
    "ladakh": "38",
    "chandigarh": "04",
    "pondicherry": "34",
    "puducherry": "34",
  };
  if (aliases[normalized]) return aliases[normalized];
  return null;
}

export type TaxTreatment = "intra_state" | "inter_state" | "unknown";

export interface GstResolutionResult {
  treatment: TaxTreatment;
  /** State code (2-digit) of the supplier, derived from companyGstin. */
  supplierStateCode: string | null;
  /** State code (2-digit) of the customer, derived from gstin or state field. */
  customerStateCode: string | null;
  /** Human-readable warning if state could not be determined. */
  warning: string | null;
  /**
   * True if the customer's GSTIN-derived state code disagrees with the
   * customer's free-text state field. This is a data-quality issue the user
   * should fix — the GSTIN state code is authoritative for tax purposes.
   */
  stateFieldMismatch: boolean;
}

/**
 * Determine whether a transaction is intra-state (CGST+SGST) or inter-state (IGST).
 *
 * Priority for customer state:
 *   1. GSTIN first-2-digits (authoritative, structurally validated)
 *   2. Free-text state field (fallback when GSTIN is absent, e.g. unregistered consumers)
 *
 * Supplier state is always derived from companyGstin (the supplier's own GSTIN).
 * If companyGstin is not configured, treatment is "unknown" and a warning is returned.
 */
export function resolveTaxTreatment(
  companyGstin: string | null | undefined,
  customerGstin: string | null | undefined,
  customerState: string | null | undefined,
): GstResolutionResult {
  const supplierStateCode = getStateCodeFromGstin(companyGstin);

  if (!supplierStateCode) {
    return {
      treatment: "unknown",
      supplierStateCode: null,
      customerStateCode: null,
      warning:
        "Supplier's home state could not be determined — company_gstin is not configured or invalid. Set the company GSTIN in System Settings to enable correct CGST/SGST vs IGST tax treatment.",
      stateFieldMismatch: false,
    };
  }

  const customerGstinStateCode = getStateCodeFromGstin(customerGstin);
  const customerFieldStateCode = getStateCodeFromName(customerState);

  // If both GSTIN and state field are present and disagree, flag it.
  // GSTIN state code is authoritative for tax purposes.
  const stateFieldMismatch =
    !!customerGstinStateCode &&
    !!customerFieldStateCode &&
    customerGstinStateCode !== customerFieldStateCode;

  // Prefer GSTIN-derived state code; fall back to state field
  const customerStateCode = customerGstinStateCode || customerFieldStateCode;

  if (!customerStateCode) {
    return {
      treatment: "unknown",
      supplierStateCode,
      customerStateCode: null,
      warning: customerGstin
        ? `Customer GSTIN "${customerGstin}" has an unrecognized state code. Tax treatment cannot be determined.`
        : "Customer has no GSTIN and no state field set. Tax treatment cannot be determined — set the customer's state or GSTIN to generate a compliant tax invoice.",
      stateFieldMismatch,
    };
  }

  const treatment: TaxTreatment =
    customerStateCode === supplierStateCode ? "intra_state" : "inter_state";

  return {
    treatment,
    supplierStateCode,
    customerStateCode,
    warning: null,
    stateFieldMismatch,
  };
}

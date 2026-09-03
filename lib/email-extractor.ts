/**
 * Enhanced Email Extractor for Lead Creation
 *
 * Extracts structured information from email content including:
 * - Location/City
 * - Estimated Value
 * - Industry Type
 * - Phone Number
 * - Company Name
 * - Formatted email body
 */

export interface ExtractedLeadInfo {
  city: string | null;
  phone: string | null;
  estimatedValue: number | null;
  industryType: string | null;
  companyName: string | null;
  formattedBody: string;
}

// Common city/location patterns
const LOCATION_PATTERNS = [
  /location[:\s]*([a-zA-Z\s,]+)/gi,
  /city[:\s]*([a-zA-Z\s,]+)/gi,
  /based in ([a-zA-Z\s,]+)/gi,
  /from ([a-zA-Z\s,]+)/gi,
  /at ([a-zA-Z\s,]+)(?:,|\.|$)/gi,
];

// Indian cities list
const INDIAN_CITIES = [
  "chennai", "mumbai", "delhi", "bangalore", "hyderabad", "pune",
  "kolkata", "ahmedabad", "jaipur", "lucknow", "kanpur", "nagpur",
  "indore", "thane", "bhopal", "visakhapatnam", "pimpri", "patna",
  "vadodara", "ghaziabad", "ludhiana", "agra", "nashik", "ranchi",
  "faridabad", "meerut", "rajkot", "varanasi", "srinagar", "aurangabad",
  "dhanbad", "amritsar", "navi mumbai", "allahabad", "howrah", "jabalpur",
  "gwalior", "vijayawada", "jodhpur", "madurai", "raipur", "kota",
  "guwahati", "chandigarh", "solapur", "hubli", "mysore", "tiruchirappalli",
  "bareilly", "aligarh", "tiruppur", "gurgaon", "moradabad", "jalandhar",
  "bhubaneswar", "salem", "warangal", "mira-bhayandar", "thiruvananthapuram",
  "bhiwandi", "saharanpur", "guntur", "amravati", "bikaner", "noida",
  "jamshedpur", "bhilai", "cuttack", "firozabad", "kochi", "nellore",
  "bhavnagar", "dehradun", "durgapur", "asansol", "rourkela", "nanded",
  "kolhapur", "ajmer", "akola", "gulbarga", "jamnagar", "ujjain", "loni",
  "siliguri", "jhansi", "ulhasnagar", "jammu", "sangli-miraj & kupwad", "mangalore",
  "erode", "belgaum", "ambattur", "tirunelveli", "malegaon", "gaya", "jalgaon",
  "udaipur", "maheshtala", "tirupur", "davanagere", "kozhikode", "akola",
  "karnal", "bathtub", "shimla", "patiala", "panipat", "sagar", "bhilwara",
  "berhampur", "muzaffarnagar", "bhatpara", "panvel", "south dumdum", "rohtak",
  "korba", "bhagalpur", "rajsamand", "bokaro", "silchar", "ulan bator", "tirupati"
];

// Industry keywords
const INDUSTRY_KEYWORDS = {
  "automotive": ["automotive", "automobile", "car", "vehicle", "motor", "tyre", "tire"],
  "pharmaceutical": ["pharma", "pharmaceutical", "medicine", "drug", "healthcare", "medical"],
  "textile": ["textile", "fabric", "garment", "apparel", "clothing", "fashion"],
  "it": ["it", "software", "technology", "tech", "computer", "digital", "app"],
  "manufacturing": ["manufacturing", "production", "factory", "industrial", "machinery"],
  "construction": ["construction", "building", "real estate", "infrastructure", "cement"],
  "retail": ["retail", "shop", "store", "ecommerce", "e-commerce", "trading"],
  "food": ["food", "restaurant", "hotel", "catering", "fmcg", "beverage"],
  "chemical": ["chemical", "petrochemical", "plastic", "polymer", "resin"],
  "steel": ["steel", "metal", "iron", "alloy", "fabrication", "welding"],
  "electronics": ["electronics", "electrical", "circuit", "pcb", "semiconductor"],
  "education": ["education", "school", "college", "university", "training", "coaching"],
  "finance": ["finance", "banking", "insurance", "investment", "fintech"],
  "logistics": ["logistics", "transport", "shipping", "supply chain", "delivery"],
  "telecom": ["telecom", "telecommunication", "network", "connectivity", "broadband"]
};

// Currency and value patterns
const VALUE_PATTERNS = [
  /(?:₹|INR|Rs\.?|rupees?)\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi,
  /\$\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi,
  /(?:budget|value|estimate|cost|price|amount)[:\s]*(?:₹|INR|Rs\.?|\$)?\s*(\d+(?:,\d+)*(?:\.\d+)?)/gi,
  /(\d+(?:,\d+)*(?:\.\d+)?)\s*(?:lakhs?|lacs?|crores?|cr|k|thousand)/gi
];

// Phone number patterns
const PHONE_PATTERNS = [
  /\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
  /\+?\d{10,15}/g,
  /\d{3}[-.\s]\d{3}[-.\s]\d{4}/g
];

// Company name patterns
const COMPANY_PATTERNS = [
  /(?:company|organization|firm|business|corporation|inc|ltd|pvt|private|limited)[:\s]*([a-zA-Z0-9\s&]+)(?:,|\.|$)/gi,
  /(?:from|at|by)\s+([A-Z][a-zA-Z0-9\s&]+(?:Pvt|Ltd|Inc|Corp|LLC|Private|Limited)?)(?:,|\.|$)/gi
];

/**
 * Extract city/location from email content
 */
function extractLocation(text: string): string | null {
  const lowerText = text.toLowerCase();

  // Check for Indian cities
  for (const city of INDIAN_CITIES) {
    if (lowerText.includes(city)) {
      return city.charAt(0).toUpperCase() + city.slice(1);
    }
  }

  // Check for location patterns
  for (const pattern of LOCATION_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const location = match[1].trim();
      if (location.length > 2 && location.length < 50) {
        return location.charAt(0).toUpperCase() + location.slice(1);
      }
    }
  }

  return null;
}

/**
 * Extract industry type from email content
 */
function extractIndustry(text: string): string | null {
  const lowerText = text.toLowerCase();

  for (const [industry, keywords] of Object.entries(INDUSTRY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerText.includes(keyword)) {
        return industry.charAt(0).toUpperCase() + industry.slice(1);
      }
    }
  }

  return null;
}

/**
 * Extract estimated value from email content
 */
function extractEstimatedValue(text: string): number | null {
  for (const pattern of VALUE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const valueMatch = match.match(/(\d+(?:,\d+)*(?:\.\d+)?)/);
        if (valueMatch) {
          let value = parseFloat(valueMatch[1].replace(/,/g, ""));

          // Handle Indian numbering system
          if (match.toLowerCase().includes("lakh") || match.toLowerCase().includes("lac")) {
            value *= 100000;
          } else if (match.toLowerCase().includes("crore") || match.toLowerCase().includes("cr")) {
            value *= 10000000;
          } else if (match.toLowerCase().includes("k") || match.toLowerCase().includes("thousand")) {
            value *= 1000;
          }

          // Only return reasonable values (between 1,000 and 100 crores)
          if (value >= 1000 && value <= 1000000000) {
            return value;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Extract phone number from email content
 */
function extractPhone(text: string): string | null {
  for (const pattern of PHONE_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const phone = match[0].replace(/[^0-9+]/g, "");
      if (phone.length >= 10 && phone.length <= 15) {
        return phone;
      }
    }
  }

  return null;
}

/**
 * Extract company name from email content
 */
function extractCompanyName(text: string): string | null {
  for (const pattern of COMPANY_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      const company = match[1].trim();
      if (company.length > 2 && company.length < 100) {
        return company;
      }
    }
  }

  return null;
}

/**
 * Format email body preserving original email structure
 */
function formatEmailBody(subject: string, body: string, fromEmail: string, fromName: string | null): string {
  const displayName = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

  // Preserve original body line breaks by normalizing but not removing them
  let preservedBody = body
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

  // Remove irrelevant email artifacts:
  // - cid: references like [id: ...] or cid:...
  // - Message-ID style brackets
  // - IMAP source metadata
  preservedBody = preservedBody
    .replace(/\n?\[id:\s*[a-f0-9-]+\]\s*$/gi, "")
    .replace(/\n?\[cid:[^\]]+\]\s*$/gi, "")
    .replace(/\n?cid:[a-zA-Z0-9-]+(?:\?[^\s]*)?\s*$/gi, "")
    .replace(/\n?--\s*\n?Original message\s*$/gi, "")
    .replace(/\n?Forwarded message:\s*$/gi, "")
    .replace(/\n?-{3,}\s*Original\s-{3,}\s*$/gi, "")
    .replace(/\n?\[image:\s*[^\]]*\]\s*$/gi, "")
    .trim();

  return [
    `From: ${displayName}`,
    `Subject: ${subject}`,
    ``,
    preservedBody,
  ].join("\n");
}

/**
 * Main extraction function
 */
export function extractLeadInfoFromEmail(
  subject: string,
  body: string,
  fromEmail: string,
  fromName: string | null
): ExtractedLeadInfo {
  const fullText = `${subject} ${body}`;

  return {
    city: extractLocation(fullText),
    phone: extractPhone(fullText),
    estimatedValue: extractEstimatedValue(fullText),
    industryType: extractIndustry(fullText),
    companyName: extractCompanyName(fullText),
    formattedBody: formatEmailBody(subject, body, fromEmail, fromName),
  };
}
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: (string | undefined | null | false | Record<string, boolean>)[]) {
  return twMerge(clsx(inputs));
}

// Avatar initials helper
export function getInitials(name: string): string {
  const clean = name.replace(/[^a-zA-Z\s]/g, " ").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Avatar color palette
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
  "bg-orange-100 text-orange-700",
];

export function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// Format date helpers
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * Format a currency amount.
 *
 * NOTE: For multi-currency display, use `useCurrency().formatCurrency()` from
 * CurrencyProvider instead — it applies exchange rate conversion automatically.
 * This function is for server-side formatting or when conversion is not needed.
 *
 * @param value - Amount in the specified currency
 * @param currency - ISO currency code (default: INR)
 * @param locale - Locale for formatting (default: en-IN)
 */
export function formatCurrency(value: number, currency = "INR", locale = "en-IN"): string {
  if (!value || isNaN(value)) return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(0);
  return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

const DEFAULT_VISIT_TIMEZONE = "Asia/Kolkata";

function getTimezoneOffset(timezone: string): string {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = formatter.formatToParts(now);
    const get = (type: string) => parts.find((p) => p.type === type)?.value;
    const tzDateStr = `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
    const tzDate = new Date(tzDateStr);
    const utcDate = new Date(now.toISOString().slice(0, 19));
    const offsetMinutes = Math.round((tzDate.getTime() - utcDate.getTime()) / (60 * 1000));
    const sign = offsetMinutes >= 0 ? "+" : "-";
    const absMinutes = Math.abs(offsetMinutes);
    const hours = Math.floor(absMinutes / 60);
    const minutes = absMinutes % 60;
    return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  } catch {
    return "+05:30";
  }
}

export function getCheckInWindow(
  plannedDate: string | Date | null | undefined,
  plannedTime: string | null | undefined,
  timezone = DEFAULT_VISIT_TIMEZONE
): { start: Date; end: Date; status: "TOO_EARLY" | "OPEN" | "TOO_LATE" } | null {
  if (!plannedDate) return null;
  // Use the UTC date part stored for plannedDate so it matches the date the user selected,
  // then combine with plannedTime in the target timezone.
  const d = new Date(plannedDate);
  const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  const time = plannedTime || "00:00";
  const offset = timezone === "Asia/Kolkata" ? "+05:30" : getTimezoneOffset(timezone);
  const planned = new Date(`${dateStr}T${time}:00${offset}`);
  const start = new Date(planned.getTime() - 15 * 60 * 1000);
  const end = new Date(planned.getTime() + 30 * 60 * 1000);
  const now = new Date();
  let status: "TOO_EARLY" | "OPEN" | "TOO_LATE" = "OPEN";
  if (now < start) status = "TOO_EARLY";
  else if (now > end) status = "TOO_LATE";
  return { start, end, status };
}

// Same formats as the web app (frontend/src/helpers/currency.ts and dates.ts).

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const INR_EXACT = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,23,456 */
export function formatInr(amount: number): string {
  return INR.format(amount);
}

/** ₹1,234.50, for statement lines. Whole rupees drop the paise. */
export function formatInrExact(amount: number): string {
  return Number.isInteger(amount) ? INR.format(amount) : INR_EXACT.format(amount);
}

/** Compact axis label, e.g. ₹8.5k or ₹2.1L. */
export function formatInrCompact(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "−" : "";
  const trim = (value: number) => {
    const text = value >= 10 ? value.toFixed(0) : value.toFixed(1);
    return text.endsWith(".0") ? text.slice(0, -2) : text;
  };
  if (abs >= 100000) return `${sign}₹${trim(abs / 100000)}L`;
  if (abs >= 1000) return `${sign}₹${trim(abs / 1000)}k`;
  return `${sign}₹${Math.round(abs)}`;
}

const RUPEE_AMOUNT = /^\d+(\.\d{1,2})?$/;

/** A typed rupee amount: 1500, 1,500, or ₹1,500.50. Empty or invalid is null. */
export function parseRupeeAmount(raw: string): number | null {
  const cleaned = raw.replace(/[₹,\s]/g, "").trim();
  if (!cleaned || !RUPEE_AMOUNT.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100) / 100;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parts(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year: year!, month: month!, day: day ?? 1 };
}

/** "6 Oct" */
export function formatShortDate(iso: string): string {
  const { month, day } = parts(iso);
  return `${day} ${MONTHS[month - 1]}`;
}

/** "Mon, 6 Oct" */
export function formatDayLabel(iso: string): string {
  const { year, month, day } = parts(iso);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday}, ${day} ${MONTHS[month - 1]}`;
}

/** "October 2026" from "2026-10" */
export function formatMonthTitle(month: string): string {
  const { year, month: m } = parts(`${month}-01`);
  return `${MONTHS_LONG[m - 1]} ${year}`;
}

/** "Oct" from "2026-10" */
export function formatMonthShort(month: string): string {
  return MONTHS[parts(`${month}-01`).month - 1]!;
}

/** "9:00 pm" */
export function formatClock(hour: number, minute: number): string {
  const suffix = hour >= 12 ? "pm" : "am";
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/** Local calendar dates as YYYY-MM-DD. Payments happen on the user's own clock. */

export function isoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function today(now = new Date()): string {
  return isoDate(now);
}

export function yesterday(now = new Date()): string {
  const date = new Date(now);
  date.setDate(date.getDate() - 1);
  return isoDate(date);
}

export function currentMonth(now = new Date()): string {
  return today(now).slice(0, 7);
}

/** "2026-10" moved by whole months. */
export function shiftMonth(month: string, by: number): string {
  const [year, m] = month.split("-").map(Number);
  const index = year! * 12 + (m! - 1) + by;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function monthRange(month: string): { from: string; to: string } {
  const [year, m] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year!, m!, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, "0")}` };
}

/** Parse YYYY-MM-DD into a local Date at noon (safe across DST). */
export function fromIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year!, month! - 1, day!, 12);
}

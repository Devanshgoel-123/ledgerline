/**
 * The top of a bar chart's scale. One huge day (a laptop, a flight) would
 * otherwise flatten every other bar to a sliver, so a value far above the
 * rest is clipped: the scale is set by the others, and the clipped bar is
 * drawn full height with a break and its real amount on top.
 */
export function chartScale(values: number[]): { max: number; step: number; clipped: boolean } {
  const sorted = values.filter((value) => value > 0).sort((a, b) => b - a);
  if (!sorted.length) return { max: 1, step: 1, clipped: false };
  const top = sorted[0]!;
  const next = sorted[1] ?? 0;
  const median = sorted[Math.floor(sorted.length / 2)]!;
  let target = top;
  let clipped = false;
  if (sorted.length >= 3 && top > next * 2.2 && top > median * 3) {
    target = next * 1.25;
    clipped = true;
  }
  const step = niceStep(target / 4);
  return { max: Math.max(step * Math.ceil(target / step), step), step, clipped };
}

/** 1, 2, 2.5 or 5 times a power of ten, at least `raw`. */
export function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(raw)));
  for (const factor of [1, 2, 2.5, 5, 10]) {
    if (factor * power >= raw) return factor * power;
  }
  return 10 * power;
}

/** Running totals for days 1..`length`, from per-day amounts keyed by day of month. */
export function runningTotals(byDay: Map<number, number>, length: number): number[] {
  const totals: number[] = [];
  let sum = 0;
  for (let day = 1; day <= length; day++) {
    sum += byDay.get(day) ?? 0;
    totals.push(sum);
  }
  return totals;
}

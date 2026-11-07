import { describe, expect, it } from "vitest";
import { chartScale, niceStep, runningTotals } from "@/core/chartScale";

describe("chart scale", () => {
  it("fits ordinary days without clipping", () => {
    const scale = chartScale([400, 650, 300, 820, 510]);
    expect(scale.clipped).toBe(false);
    expect(scale.max).toBeGreaterThanOrEqual(820);
    expect(scale.max / scale.step).toBeLessThanOrEqual(4);
  });

  it("clips one huge day so the rest stay readable", () => {
    const scale = chartScale([400, 650, 300, 18000, 510]);
    expect(scale.clipped).toBe(true);
    expect(scale.max).toBeLessThan(2000);
    // The second-tallest day still fills most of the chart.
    expect(650 / scale.max).toBeGreaterThan(0.4);
  });

  it("does not clip with too few days to tell", () => {
    expect(chartScale([200, 9000]).clipped).toBe(false);
    expect(chartScale([]).max).toBe(1);
  });

  it("uses round steps", () => {
    expect(niceStep(270)).toBe(500);
    expect(niceStep(180)).toBe(200);
    expect(niceStep(2100)).toBe(2500);
  });

  it("adds up day by day", () => {
    expect(runningTotals(new Map([[1, 100], [3, 50]]), 4)).toEqual([100, 100, 150, 150]);
  });
});

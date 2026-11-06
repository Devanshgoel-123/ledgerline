// Makes every bundled logo sit the same way in its rounded tile.
//
// Logos come in two shapes:
// - App icons, full-bleed (opaque corners): left as they are; the tile's
//   rounded corners crop them like a home screen does.
// - Marks on a transparent or white page (favicons, site icons): some touch
//   the edges and lose their corners to the tile's rounding, others are a
//   speck in a sea of white. These are trimmed to the mark itself and
//   centred on a square at a fixed share of the tile, on white, or on near
//   black when the mark itself is white.
//
// Run once per logo, on the downloaded original: a second pass resamples it again.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { PNG } from "pngjs";

/** How much of the tile the mark's longer side takes. */
export const MARK_SHARE = 0.74;
const LIGHT = [255, 255, 255];
const DARK = [17, 20, 24];

const isPage = (r, g, b, a) => a < 40 || (r > 240 && g > 240 && b > 240);

/** Returns "bleed" (left alone) or "padded" (trimmed and re-centred). */
export function normalizeLogo(file, size = 144) {
  const src = PNG.sync.read(readFileSync(file));
  const { width: w, height: h, data } = src;
  const at = (x, y) => {
    const i = (y * w + x) * 4;
    return [data[i], data[i + 1], data[i + 2], data[i + 3]];
  };
  const inset = Math.max(1, Math.round(w * 0.02));
  const corners = [at(inset, inset), at(w - 1 - inset, inset), at(inset, h - 1 - inset), at(w - 1 - inset, h - 1 - inset)];
  if (corners.every((c) => !isPage(...c))) return "bleed";

  // The mark: every pixel that isn't the page.
  let x0 = w, y0 = h, x1 = -1, y1 = -1, lum = 0, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = at(x, y);
      if (a >= 40) {
        lum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
        count++;
      }
      if (isPage(r, g, b, a)) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  // Nothing but white: a white mark on a transparent page. Put it on dark.
  const whiteMark = x1 < 0 || (count > 0 && lum / count > 235 && corners.some((c) => c[3] < 40));
  if (x1 < 0) {
    // Trim to anything opaque instead.
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (at(x, y)[3] >= 40) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 < 0) return "bleed";
  }
  const markW = x1 - x0 + 1;
  const markH = y1 - y0 + 1;
  // An app icon drawn as a rounded square or circle on a transparent page:
  // solid all along its edges. It fills the tile (a circle a little
  // less) rather than sitting as a small icon inside another.
  const solid = (fx, fy) => {
    const [r, g, b, a] = at(Math.round(x0 + fx * (markW - 1)), Math.round(y0 + fy * (markH - 1)));
    return a >= 200 && !isPage(r, g, b, a);
  };
  const square = Math.abs(markW - markH) <= Math.max(2, markW * 0.04);
  const edge = [0.3, 0.5, 0.7].flatMap((t) => [[t, 0.04], [t, 0.96], [0.04, t], [0.96, t]]);
  const shape = square && edge.every(([fx, fy]) => solid(fx, fy));
  const round = shape && !solid(0.1, 0.1);
  const share = shape ? (round ? 0.94 : 1) : MARK_SHARE;
  const side = Math.ceil(Math.max(markW, markH) / share);
  const bg = whiteMark ? DARK : LIGHT;
  const out = new PNG({ width: side, height: side });
  for (let i = 0; i < side * side; i++) {
    out.data[i * 4] = bg[0];
    out.data[i * 4 + 1] = bg[1];
    out.data[i * 4 + 2] = bg[2];
    out.data[i * 4 + 3] = 255;
  }
  const ox = Math.floor((side - markW) / 2);
  const oy = Math.floor((side - markH) / 2);
  for (let y = 0; y < markH; y++) {
    for (let x = 0; x < markW; x++) {
      const [r, g, b, a] = at(x0 + x, y0 + y);
      const k = a / 255;
      const j = ((oy + y) * side + (ox + x)) * 4;
      out.data[j] = Math.round(r * k + bg[0] * (1 - k));
      out.data[j + 1] = Math.round(g * k + bg[1] * (1 - k));
      out.data[j + 2] = Math.round(b * k + bg[2] * (1 - k));
    }
  }
  writeFileSync(file, PNG.sync.write(out));
  // sips ships with macOS: back to the bundle size.
  execFileSync("sips", ["-z", String(size), String(size), file, "--out", file], { stdio: "ignore" });
  return "padded";
}

// `node scripts/normalize-logo.mjs a.png b.png …` normalises those files.
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const file of process.argv.slice(2)) console.log(`${normalizeLogo(file).padEnd(7)} ${file}`);
}

// Downloads a logo for every brand with a website (src/core/brands.ts) into
// assets/brands/, and writes src/ui/brandLogos.generated.ts, which bundles
// them with the app. The phone never fetches a logo: a request naming the
// shop would tell a server where you spend.
//
// Run by hand when brands change, and commit the result:
//   npm run brand-logos
//
// Source: the icon each site declares for home screens (apple-touch-icon or
// its web manifest), else Google's favicon service. Square icons of 96px or
// more only, resized to 144px; brands without one show their category icon.
// Each new logo is then trimmed and centred (scripts/normalize-logo.mjs) so
// every brand sits the same way in its tile.
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { normalizeLogo } from "./normalize-logo.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");
const outDir = join(root, "assets/brands");
const outTs = join(root, "src/ui/brandLogos.generated.ts");

// Read brands.ts and catalog.generated.json without a TypeScript build: the
// two lists are plain data.
const brandsSource = readFileSync(join(root, "src/core/brands.ts"), "utf8");
const catalog = createRequire(import.meta.url)(join(root, "src/core/catalog.generated.json"));

const domains = new Map(); // brand name -> domain
for (const [, name, domain] of brandsSource.matchAll(/^\s+"?([^":]+?)"?: \{ domain: "([^"]+)"/gm)) domains.set(name, domain);
for (const [, name, domain] of brandsSource.matchAll(/^\s+b\("([^"]+)", "([^"]+)"/gm)) domains.set(name, domain);
const known = new Set([...catalog.providers.map((p) => p.canonicalName), ...[...brandsSource.matchAll(/^\s+b\("([^"]+)"/gm)].map((m) => m[1])]);

const fileKey = (name) =>
  name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.3 Mobile/15E148 Safari/604.1";
const TARGET = 144; // 48pt at 3x

function imageSize(bytes) {
  if (bytes.length < 24) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50) {
    const view = new DataView(bytes.buffer, bytes.byteOffset);
    return { width: view.getUint32(16), height: view.getUint32(20), type: "png" };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    // JPEG: walk the segments to the SOF marker.
    let i = 2;
    while (i < bytes.length) {
      if (bytes[i] !== 0xff) return null;
      const marker = bytes[i + 1];
      const length = (bytes[i + 2] << 8) | bytes[i + 3];
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { height: (bytes[i + 5] << 8) | bytes[i + 6], width: (bytes[i + 7] << 8) | bytes[i + 8], type: "jpg" };
      }
      i += 2 + length;
    }
  }
  return null;
}

async function get(url, timeout = 12000) {
  try {
    const response = await fetch(url, { headers: { "user-agent": UA, accept: "*/*" }, redirect: "follow", signal: AbortSignal.timeout(timeout) });
    if (!response.ok) return null;
    return { url: response.url, type: response.headers.get("content-type") ?? "", bytes: new Uint8Array(await response.arrayBuffer()) };
  } catch {
    return null;
  }
}

/** Icon URLs a page declares: apple-touch-icon, sized icons, and its web manifest's icons. */
async function declaredIcons(pageUrl) {
  const page = await get(pageUrl);
  if (!page || !page.type.includes("html")) return [];
  const html = new TextDecoder().decode(page.bytes.slice(0, 400000));
  const urls = [];
  let manifest = null;
  for (const [tag] of html.matchAll(/<link\b[^>]*>/gi)) {
    const rel = /rel=["']?([^"'>]+)/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    const href = /href=["']?([^"' >]+)/i.exec(tag)?.[1];
    if (!href) continue;
    if (rel.includes("manifest")) manifest = new URL(href, page.url).href;
    else if (rel.includes("apple-touch-icon") || rel.includes("icon")) urls.push(new URL(href.replace(/&amp;/g, "&"), page.url).href);
  }
  if (manifest) {
    const file = await get(manifest);
    try {
      const json = JSON.parse(new TextDecoder().decode(file?.bytes));
      for (const icon of json.icons ?? []) if (icon.src) urls.push(new URL(icon.src, manifest).href);
    } catch {}
  }
  return urls;
}

async function fetchLogo(domain) {
  const bare = domain.replace(/^www\./, "");
  const origins = bare.includes("/") || bare.split(".").length > 2 ? [`https://${bare}`] : [`https://www.${bare}`, `https://${bare}`];
  const candidates = [];
  for (const origin of origins) {
    candidates.push(...(await declaredIcons(origin)));
    candidates.push(`${origin}/apple-touch-icon.png`, `${origin}/apple-touch-icon-precomposed.png`);
  }
  candidates.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(bare)}&sz=256`);
  let best = null;
  for (const url of [...new Set(candidates)]) {
    if (/\.svg(\?|$)/i.test(url)) continue;
    const file = await get(url);
    if (!file) continue;
    const dims = imageSize(file.bytes);
    if (!dims || dims.width < 96 || Math.abs(dims.width - dims.height) > 2) continue;
    if (!best || dims.width > best.dims.width) best = { bytes: file.bytes, dims };
    if (best.dims.width >= TARGET) break;
  }
  return best;
}

const squash = (text) =>
  text
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

/**
 * The brand's iPhone app icon, from the App Store search API (India store).
 * Taken only when the app's or developer's name contains the brand's name, so
 * a search for a small brand can't return a bigger rival's icon.
 */
// Logos checked by eye and rejected: a placeholder, someone else's mark, or too blurry.
// These brands show their category icon instead.
const SKIP = new Set(["BluSmart", "FASTag", "GiveIndia", "Subway", "Spencer's", "Tata Power", "Theobroma", "Naturals Salon"]);

// App Store searches that returned someone else's app (checked by eye).
const NOT_ON_APP_STORE = new Set(["Crossword", "Google Play", "Scaler", "Urban Ladder", "Reliance Trends", "W for Woman", "Metro Shoes", "Mumbai Metro", "Mainland China", "ICICI Prudential MF", "Lemon Tree", "Burger Singh", "Sangeetha Mobiles", "Zudio"]);

async function appStoreIcon(name) {
  if (NOT_ON_APP_STORE.has(name)) return null;
  const search = await get(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&country=in&entity=software&limit=8`);
  if (!search) return null;
  let results = [];
  try {
    results = JSON.parse(new TextDecoder().decode(search.bytes)).results ?? [];
  } catch {
    return null;
  }
  const words = name.split(/[^A-Za-z0-9]+/).filter((word) => word.length >= 2);
  const key = squash(words.length > 1 && words[0].length < 4 ? words.slice(0, 2).join("") : (words[0] ?? name));
  const match = results.find((app) => squash(`${app.trackName} ${app.sellerName}`).includes(key));
  if (!match?.artworkUrl512) return null;
  const file = await get(match.artworkUrl512);
  const dims = file && imageSize(file.bytes);
  return dims ? { bytes: file.bytes, dims, source: `app: ${match.trackName}` } : null;
}

mkdirSync(outDir, { recursive: true });
const entries = [];
const missing = [];
const byDomain = new Map();
for (const [name, domain] of [...domains].sort((a, b) => a[0].localeCompare(b[0]))) {
  if (SKIP.has(name)) {
    missing.push(`${name} (skipped)`);
    continue;
  }
  if (!known.has(name)) {
    console.warn(`skip ${name}: not a known brand name`);
    continue;
  }
  const key = fileKey(domain);
  const file = join(outDir, `${key}.png`);
  if (!byDomain.has(domain)) {
    let ok = existsSync(file);
    if (!ok) {
      const logo = (await fetchLogo(domain)) ?? (await appStoreIcon(name));
      if (logo) {
        const raw = `${file}.${logo.dims.type}`;
        writeFileSync(raw, logo.bytes);
        // Same size and format for every logo: sips ships with macOS.
        execFileSync("sips", ["-s", "format", "png", "-Z", String(TARGET), raw, "--out", file], { stdio: "ignore" });
        unlinkSync(raw);
        normalizeLogo(file, TARGET);
        ok = true;
        console.log(`${name.padEnd(24)} ${domain.padEnd(28)} ${logo.dims.width}px ${logo.source ?? "site"}`);
      }
    }
    byDomain.set(domain, ok);
  }
  if (byDomain.get(domain)) entries.push([name, key]);
  else missing.push(`${name} (${domain})`);
}

const lines = entries.map(([name, key]) => `  ${JSON.stringify(`catalog:${name.toLowerCase()}`)}: require("../../assets/brands/${key}.png"),`);
writeFileSync(
  outTs,
  `// Generated by scripts/fetch-brand-logos.mjs. Do not edit.\n// Brand logos bundled with the app, by provider id. Nothing is fetched at runtime.\nexport const BRAND_LOGOS: Record<string, number> = {\n${lines.join("\n")}\n};\n`,
);
console.log(`\n${entries.length} logos bundled, ${missing.length} without one${missing.length ? `:\n  ${missing.join("\n  ")}` : ""}`);

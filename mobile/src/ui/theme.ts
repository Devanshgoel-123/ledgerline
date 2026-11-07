import { useColorScheme } from "react-native";
import { TAXONOMY } from "@/core/taxonomy";

// Ledgerline's phone theme, "calm ledger".
//
// First principles:
// 1. Money is the content. Amounts are set in ink, large and tabular; colour
//    is never decoration.
// 2. Colour means something. One brand blue for things you can tap; green
//    only for money in; red only for a problem (over a limit, an error, a
//    delete). Ordinary spending is not a warning, so it is not red or orange.
// 3. Calm. Cool, low-saturation neutrals; one gradient in the whole app (the
//    Overview summary), deep navy to ocean, close in value so it reads as
//    depth rather than decoration.
// 4. Quiet depth. Hairline borders and a faint shadow, no heavy elevation.
// 5. Readable by everyone. Every text pair is WCAG AA (4.5:1) or better in
//    both modes; see docs/MOBILE_DESIGN_HANDOFF.md.

const light = {
  bg: "#f3f5f8",
  bgMuted: "#e8ecf1",
  surface: "#ffffff",
  foreground: "#0f1b2a",
  muted: "#526070",
  muted2: "#677485",
  border: "rgba(15, 27, 42, 0.08)",
  borderStrong: "rgba(15, 27, 42, 0.14)",
  primary: "#1d5c96",
  primarySoft: "rgba(29, 92, 150, 0.09)",
  primaryForeground: "#ffffff",
  /** A tint on top of a primary fill (icon wells on primary buttons). */
  onPrimarySoft: "rgba(255, 255, 255, 0.16)",
  /** Used sparingly for highlights; spend amounts themselves are ink. */
  accent: "#a24f2b",
  accentSoft: "rgba(162, 79, 43, 0.09)",
  parchment: "#f6ead6",
  parchmentInk: "#845710",
  warningSoft: "rgba(176, 122, 26, 0.12)",
  success: "#1b7a4e",
  successSoft: "rgba(27, 122, 78, 0.09)",
  danger: "#b42318",
  dangerSoft: "rgba(180, 35, 24, 0.08)",
  credit: "#1b7a4e",
  debit: "#b42318",
  heroFrom: "#0e2742",
  heroMid: "#1d5c96",
  heroTo: "#14606a",
  /** Glass: a frosted fill, a bright top edge and a hairline. */
  glassFill: "rgba(255, 255, 255, 0.58)",
  glassFillSolid: "rgba(255, 255, 255, 0.86)",
  glassEdge: "rgba(255, 255, 255, 0.95)",
  glassBorder: "rgba(15, 27, 42, 0.07)",
  /** The backdrop's soft light: ocean, lagoon and a little dusk. */
  aura1: "#4f8fd0",
  aura2: "#35b3a3",
  aura3: "#e2a36c",
  onHero: "#ffffff",
  onHeroMuted: "#c6d6e3",
  heroTrack: "rgba(255, 255, 255, 0.18)",
  heroChip: "rgba(255, 255, 255, 0.14)",
  heroWarn: "#f6b8ab",
  chartGrid: "rgba(15, 27, 42, 0.07)",
  barCalm: "#c3d2e1",
  barHot: "#dc8a7d",
  barPeak: "#1d5c96",
  overlay: "rgba(15, 27, 42, 0.45)",
  shadow: "rgba(16, 42, 67, 0.07)",
};

export type Palette = typeof light;

const dark: Palette = {
  bg: "#0b1219",
  bgMuted: "#17212c",
  surface: "#111a23",
  foreground: "#e6edf3",
  muted: "#9aa8b6",
  muted2: "#8494a4",
  border: "rgba(230, 237, 243, 0.08)",
  borderStrong: "rgba(230, 237, 243, 0.14)",
  primary: "#82b4e3",
  primarySoft: "rgba(130, 180, 227, 0.14)",
  primaryForeground: "#0b1219",
  onPrimarySoft: "rgba(11, 18, 25, 0.12)",
  accent: "#e39a72",
  accentSoft: "rgba(227, 154, 114, 0.13)",
  parchment: "#33270f",
  parchmentInk: "#e2b86f",
  warningSoft: "rgba(226, 184, 111, 0.13)",
  success: "#5dc795",
  successSoft: "rgba(93, 199, 149, 0.13)",
  danger: "#f08a7e",
  dangerSoft: "rgba(240, 138, 126, 0.13)",
  credit: "#5dc795",
  debit: "#f08a7e",
  heroFrom: "#0c1f35",
  heroMid: "#1b4f80",
  heroTo: "#125a5c",
  glassFill: "rgba(24, 36, 50, 0.52)",
  glassFillSolid: "rgba(20, 31, 43, 0.9)",
  glassEdge: "rgba(255, 255, 255, 0.12)",
  glassBorder: "rgba(230, 237, 243, 0.08)",
  aura1: "#1d5c96",
  aura2: "#127a70",
  aura3: "#5d4f9c",
  onHero: "#ffffff",
  onHeroMuted: "#c6d6e3",
  heroTrack: "rgba(255, 255, 255, 0.16)",
  heroChip: "rgba(255, 255, 255, 0.12)",
  heroWarn: "#f6b8ab",
  chartGrid: "rgba(230, 237, 243, 0.07)",
  barCalm: "#2c4054",
  barHot: "#d47a6d",
  barPeak: "#82b4e3",
  overlay: "rgba(0, 0, 0, 0.6)",
  shadow: "rgba(0, 0, 0, 0.5)",
};

// One muted hue per top-level category; sub-categories wear their parent's,
// so a list never turns into confetti. Light hues pass 4.5:1 as icon/text on
// their own 12% tint and as white text on a solid fill; dark hues do the same
// on the dark surface.
const ROOT_HUES: Record<string, [light: string, dark: string]> = {
  food: ["#b0522a", "#eba27c"],
  grocery: ["#4b7428", "#a9d17f"],
  shopping: ["#a3456b", "#e8a0c0"],
  transport: ["#22707e", "#86c9d2"],
  travel: ["#2e6590", "#94bce0"],
  bills: ["#8a6510", "#e3c272"],
  household: ["#3a5ea3", "#9db8e6"],
  subscriptions: ["#7a4ea3", "#c9abea"],
  outing: ["#5d4f9c", "#b8adea"],
  healthcare: ["#b03b3b", "#f0a099"],
  personal: ["#287069", "#84cbc3"],
  education: ["#1d6a86", "#84c6de"],
  family: ["#874a8c", "#d6a9da"],
  gifts: ["#ad3f6c", "#efa3c3"],
  vices: ["#8c5d18", "#e2c07f"],
  emi: ["#6d5a28", "#d6c38e"],
  insurance: ["#36694f", "#97d1b5"],
  fees: ["#59616e", "#b0b8c3"],
  investments: ["#21734f", "#86d0ab"],
  transfers: ["#4f6178", "#aab8c9"],
  income: ["#1b7a4e", "#6fd09f"],
  other: ["#5f6a78", "#aab3be"],
};

const categoryLight: Record<string, string> = {};
const categoryDark: Record<string, string> = {};
for (const root of TAXONOMY) {
  const [light, dark] = ROOT_HUES[root.slug] ?? ROOT_HUES.other!;
  for (const slug of [root.slug, ...(root.children ?? []).map((child) => child.slug)]) {
    categoryLight[slug] = light;
    categoryDark[slug] = dark;
  }
}

/** Colours for categories you add, picked by name so each keeps its colour. */
const EXTRA_LIGHT = ["#2e5b8c", "#1f7a6e", "#8b5a2b", "#7b4e8f", "#a14d5d", "#4f6a2e"];
const EXTRA_DARK = ["#a9c2e4", "#8ccbc0", "#e2bf94", "#cdb0dd", "#e5aab5", "#bcd39a"];

export interface Theme {
  dark: boolean;
  c: Palette;
  categoryColor(slug: string | null | undefined): string;
  /** Text colour that reads on a category fill. */
  onCategory: string;
}

function makeTheme(isDark: boolean): Theme {
  const map = isDark ? categoryDark : categoryLight;
  const extra = isDark ? EXTRA_DARK : EXTRA_LIGHT;
  return {
    dark: isDark,
    c: isDark ? dark : light,
    onCategory: isDark ? "#0b1219" : "#ffffff",
    categoryColor(slug) {
      if (!slug) return map.other!;
      if (map[slug]) return map[slug]!;
      let h = 0;
      for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
      return extra[Math.abs(h) % extra.length]!;
    },
  };
}

const LIGHT = makeTheme(false);
const DARK = makeTheme(true);

export function useTheme(): Theme {
  return useColorScheme() === "dark" ? DARK : LIGHT;
}

/** The light tints, for dots on the widget's navy background. */
export function categoryColorOnDark(slug: string | null | undefined): string {
  return DARK.categoryColor(slug);
}

export const fonts = {
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemi: "Inter_600SemiBold",
  // One typeface throughout: Inter's heavier weights do the display work. A
  // characterful display face read as playful; money wants plain and steady.
  display: "Inter_600SemiBold",
  // Amounts use Inter with tabular figures. The names stay so existing
  // styles keep working.
  mono: "Inter_500Medium",
  monoMedium: "Inter_600SemiBold",
};

/** Lines digits up in columns of amounts. */
export const tabular = { fontVariant: ["tabular-nums" as const] };

/** One easing and three durations for every movement in the app. */
export const motion = {
  fast: 160,
  base: 260,
  enter: 460,
  /** Between items that enter together, at most six of them. */
  stagger: 50,
  bezier: [0.22, 1, 0.36, 1] as const,
};

export const radius = { sm: 10, md: 12, lg: 16, xl: 22, pill: 999 };
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 };

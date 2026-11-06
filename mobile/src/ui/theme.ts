import { useColorScheme } from "react-native";

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
  heroFrom: "#102a43",
  heroTo: "#1d5a73",
  onHero: "#ffffff",
  onHeroMuted: "#c6d6e3",
  heroTrack: "rgba(255, 255, 255, 0.18)",
  heroChip: "rgba(255, 255, 255, 0.14)",
  heroWarn: "#f6b8ab",
  chartGrid: "rgba(15, 27, 42, 0.07)",
  barCalm: "#c3d2e1",
  barWatch: "#dcb57a",
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
  heroFrom: "#0f2236",
  heroTo: "#1a4a63",
  onHero: "#ffffff",
  onHeroMuted: "#c6d6e3",
  heroTrack: "rgba(255, 255, 255, 0.16)",
  heroChip: "rgba(255, 255, 255, 0.12)",
  heroWarn: "#f6b8ab",
  chartGrid: "rgba(230, 237, 243, 0.07)",
  barCalm: "#2c4054",
  barWatch: "#c79b57",
  barHot: "#d47a6d",
  barPeak: "#82b4e3",
  overlay: "rgba(0, 0, 0, 0.6)",
  shadow: "rgba(0, 0, 0, 0.5)",
};

// Twelve roots, twelve muted hues: distinct enough to tell apart on a chart,
// quiet enough to sit together. Light fills carry white initials at 5:1 or
// better; dark fills carry #0b1219 initials at 8.5:1 or better. Sub-categories
// take a shade of their parent's hue.
const categoryLight: Record<string, string> = {
  food: "#a9552f",
  shopping: "#a3456b",
  travel: "#2e6590", petrol: "#285a7e", "scooty-rental": "#2a6e7c", stays: "#36508a", rides: "#2a6e7c",
  healthcare: "#ab3f3b", pharmacy: "#99394f",
  family: "#874a8c", "from-home": "#77427f",
  outing: "#5d4f9c", dinner: "#53468a", "fun-activity": "#684a96", sports: "#4a4884",
  investments: "#22775a", "self-transfer": "#5a6574",
  vices: "#8c5d18", booze: "#7a5016", cigarettes: "#6a4a20",
  banks: "#55657a",
  household: "#3a61a3", rent: "#2f5596", brokerage: "#36508a", grocery: "#52752b", "passed-on": "#636e7b",
  personal: "#2a716c", salon: "#9c4569", salary: "#2d7543", "random-expense": "#6a625a",
  other: "#646f7d",
};

const categoryDark: Record<string, string> = {
  food: "#e3a17d",
  shopping: "#e09cbb",
  travel: "#8fb8dc", petrol: "#a8c7e3", "scooty-rental": "#86c4cd", stays: "#a7b6e4", rides: "#86c4cd",
  healthcare: "#ea9c95", pharmacy: "#e3a1b2",
  family: "#d1a4d5", "from-home": "#dbb6de",
  outing: "#b4a9e4", dinner: "#c4bcea", "fun-activity": "#c3aae4", sports: "#aaaddd",
  investments: "#82cda9", "self-transfer": "#a8b1bc",
  vices: "#e0be7d", booze: "#e9cc92", cigarettes: "#e4d2aa",
  banks: "#a9b6c5",
  household: "#95b4e4", rent: "#aac2ea", brokerage: "#b1bde4", grocery: "#b6d38d", "passed-on": "#c2c9d1",
  personal: "#84c9c2", salon: "#e6a9c4", salary: "#91d2a1", "random-expense": "#d0c9c1",
  other: "#a8b1bc",
};

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
  displayBold: "Inter_700Bold",
  // Amounts use Inter with tabular figures. The names stay so existing
  // styles keep working.
  mono: "Inter_500Medium",
  monoMedium: "Inter_600SemiBold",
};

/** Lines digits up in columns of amounts. */
export const tabular = { fontVariant: ["tabular-nums" as const] };

export const radius = { sm: 10, md: 12, lg: 16, xl: 22, pill: 999 };
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 };

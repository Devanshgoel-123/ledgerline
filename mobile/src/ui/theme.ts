import { useColorScheme } from "react-native";

// Ledgerline's phone theme: one vivid indigo for action and brand, a warm
// orange for spend, green for money in, and a distinct hue per category.
// Every text pair is AA (4.5:1) or better in both modes; see
// docs/MOBILE_DESIGN_HANDOFF.md for the measured ratios.

const light = {
  bg: "#f6f6fb",
  bgMuted: "#eeeef6",
  surface: "#ffffff",
  foreground: "#12121f",
  muted: "#5b5c70",
  muted2: "#6e6f84",
  border: "rgba(18, 18, 31, 0.08)",
  borderStrong: "rgba(18, 18, 31, 0.14)",
  primary: "#4f46e5",
  primarySoft: "rgba(79, 70, 229, 0.10)",
  primaryForeground: "#ffffff",
  /** Spend. */
  accent: "#c2410c",
  accentSoft: "rgba(234, 88, 12, 0.10)",
  parchment: "#fde7d6",
  parchmentInk: "#9a3412",
  warningSoft: "rgba(245, 158, 11, 0.14)",
  success: "#047857",
  successSoft: "rgba(4, 120, 87, 0.10)",
  danger: "#b91c1c",
  dangerSoft: "rgba(220, 38, 38, 0.10)",
  credit: "#047857",
  debit: "#b91c1c",
  heroFrom: "#4f46e5",
  heroTo: "#7c3aed",
  onHero: "#ffffff",
  onHeroMuted: "rgba(255, 255, 255, 0.82)",
  chartGrid: "rgba(18, 18, 31, 0.07)",
  barCalm: "#c7c4f5",
  barWatch: "#fdba74",
  barHot: "#f87171",
  barPeak: "#4f46e5",
  overlay: "rgba(18, 18, 31, 0.45)",
  shadow: "rgba(40, 36, 120, 0.10)",
};

export type Palette = typeof light;

const dark: Palette = {
  bg: "#0b0b14",
  bgMuted: "#1c1c29",
  surface: "#15151f",
  foreground: "#f2f2f8",
  muted: "#a3a4b8",
  muted2: "#8b8ca3",
  border: "rgba(255, 255, 255, 0.08)",
  borderStrong: "rgba(255, 255, 255, 0.14)",
  primary: "#8b85ff",
  primarySoft: "rgba(139, 133, 255, 0.16)",
  primaryForeground: "#0b0b14",
  accent: "#ff8a4c",
  accentSoft: "rgba(255, 138, 76, 0.14)",
  parchment: "#3a2414",
  parchmentInk: "#fdba74",
  warningSoft: "rgba(251, 191, 36, 0.14)",
  success: "#34d399",
  successSoft: "rgba(52, 211, 153, 0.14)",
  danger: "#f87171",
  dangerSoft: "rgba(248, 113, 113, 0.14)",
  credit: "#34d399",
  debit: "#f87171",
  heroFrom: "#3730a3",
  heroTo: "#6d28d9",
  onHero: "#ffffff",
  onHeroMuted: "rgba(255, 255, 255, 0.82)",
  chartGrid: "rgba(242, 242, 248, 0.07)",
  barCalm: "#3b3870",
  barWatch: "#fb923c",
  barHot: "#f87171",
  barPeak: "#8b85ff",
  overlay: "rgba(0, 0, 0, 0.6)",
  shadow: "rgba(0, 0, 0, 0.5)",
};

// Twelve roots, twelve hues. Light fills carry white initials at 4.5:1 or
// better; dark fills carry #0b0b14 initials at 7:1 or better. Sub-categories
// take a shade of their parent's hue.
const categoryLight: Record<string, string> = {
  food: "#c2410c",
  shopping: "#db2777",
  travel: "#0369a1", petrol: "#075985", "scooty-rental": "#0e7490", stays: "#1e40af", rides: "#0e7490",
  healthcare: "#dc2626", pharmacy: "#be123c",
  family: "#c026d3", "from-home": "#a21caf",
  outing: "#7c3aed", dinner: "#6d28d9", "fun-activity": "#7e22ce", sports: "#5b21b6",
  investments: "#047857", "self-transfer": "#4b5563",
  vices: "#b45309", booze: "#92400e", cigarettes: "#78350f",
  banks: "#475569",
  household: "#2563eb", rent: "#1d4ed8", brokerage: "#1e40af", grocery: "#4d7c0f", "passed-on": "#64748b",
  personal: "#0f766e", salon: "#be185d", salary: "#166534", "random-expense": "#57534e",
  other: "#6b7280",
};

const categoryDark: Record<string, string> = {
  food: "#fb923c",
  shopping: "#f472b6",
  travel: "#38bdf8", petrol: "#7dd3fc", "scooty-rental": "#22d3ee", stays: "#93c5fd", rides: "#67e8f9",
  healthcare: "#f87171", pharmacy: "#fb7185",
  family: "#e879f9", "from-home": "#f0abfc",
  outing: "#a78bfa", dinner: "#c4b5fd", "fun-activity": "#c084fc", sports: "#a5b4fc",
  investments: "#34d399", "self-transfer": "#9ca3af",
  vices: "#fbbf24", booze: "#fcd34d", cigarettes: "#fde68a",
  banks: "#94a3b8",
  household: "#60a5fa", rent: "#93c5fd", brokerage: "#a5b4fc", grocery: "#a3e635", "passed-on": "#cbd5e1",
  personal: "#2dd4bf", salon: "#f9a8d4", salary: "#4ade80", "random-expense": "#d6d3d1",
  other: "#9ca3af",
};

/** Colours for categories you add, picked by name so each keeps its colour. */
const EXTRA_LIGHT = ["#9333ea", "#0891b2", "#be123c", "#4338ca", "#a16207", "#15803d"];
const EXTRA_DARK = ["#d8b4fe", "#67e8f9", "#fda4af", "#a5b4fc", "#fde047", "#86efac"];

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
    onCategory: isDark ? "#0b0b14" : "#ffffff",
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

/** The light theme's category colours, for places with no hook (the widget). */
export function categoryColorLight(slug: string | null | undefined): string {
  return LIGHT.categoryColor(slug);
}

export const fonts = {
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemi: "Inter_600SemiBold",
  display: "BricolageGrotesque_600SemiBold",
  displayBold: "BricolageGrotesque_700Bold",
  // Amounts use Inter with tabular figures; a code font read as "developer
  // tool" to consumers. The names stay so existing styles keep working.
  mono: "Inter_500Medium",
  monoMedium: "Inter_600SemiBold",
};

/** Lines digits up in columns of amounts. */
export const tabular = { fontVariant: ["tabular-nums" as const] };

export const radius = { sm: 10, md: 14, lg: 20, xl: 28, pill: 999 };
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 };

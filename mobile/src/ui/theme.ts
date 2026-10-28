import { useColorScheme } from "react-native";

// The web app's tokens (frontend/src/app/styles/tokens.css and theme.css),
// so the phone and the browser look like one product.

const light = {
  bg: "#f5f8f6",
  bgMuted: "#eef2ee",
  surface: "#ffffff",
  foreground: "#0e1611",
  muted: "#5c665d",
  muted2: "#8a9288",
  border: "rgba(9, 20, 12, 0.09)",
  borderStrong: "rgba(9, 20, 12, 0.16)",
  primary: "#3c3834",
  primarySoft: "rgba(60, 56, 52, 0.08)",
  primaryForeground: "#f7f3ee",
  copper: "#c46b3a",
  copperSoft: "rgba(196, 107, 58, 0.12)",
  parchment: "#e4d5bc",
  parchmentInk: "#7a6240",
  warningSoft: "rgba(196, 176, 138, 0.22)",
  success: "#3f6b52",
  successSoft: "rgba(63, 107, 82, 0.12)",
  danger: "#7a5348",
  dangerSoft: "rgba(143, 106, 92, 0.12)",
  credit: "#3f6b52",
  debit: "#7a5348",
  chartGrid: "rgba(14, 22, 17, 0.08)",
  barCalm: "#b7aea3",
  barWatch: "#e0d0b4",
  barHot: "#c4a496",
  barPeak: "#c46b3a",
  overlay: "rgba(14, 22, 17, 0.45)",
  shadow: "rgba(9, 20, 12, 0.08)",
};

export type Palette = typeof light;

const dark: Palette = {
  bg: "#0a0c0b",
  bgMuted: "#10130f",
  surface: "#10130f",
  foreground: "#e9efea",
  muted: "#8b948c",
  muted2: "#6b7368",
  border: "rgba(255, 255, 255, 0.07)",
  borderStrong: "rgba(255, 255, 255, 0.13)",
  primary: "#c9c2b8",
  primarySoft: "rgba(201, 194, 184, 0.1)",
  primaryForeground: "#141210",
  copper: "#c46b3a",
  copperSoft: "rgba(196, 107, 58, 0.16)",
  parchment: "#d4c6b0",
  parchmentInk: "#d4c6b0",
  warningSoft: "rgba(212, 198, 176, 0.14)",
  success: "#9aafa0",
  successSoft: "rgba(154, 175, 160, 0.14)",
  danger: "#c4a497",
  dangerSoft: "rgba(143, 114, 102, 0.16)",
  credit: "#9aafa0",
  debit: "#c4a497",
  chartGrid: "rgba(233, 239, 234, 0.07)",
  barCalm: "#3e3a35",
  barWatch: "#d4c6b0",
  barHot: "#8f7266",
  barPeak: "#c46b3a",
  overlay: "rgba(0, 0, 0, 0.6)",
  shadow: "rgba(0, 0, 0, 0.4)",
};

const categoryLight: Record<string, string> = {
  food: "#6b7c4e", shopping: "#5a7c6f", travel: "#4a7a8f", grocery: "#7a8856",
  healthcare: "#8a6f7b", pharmacy: "#a0798b", household: "#5fa87d", furniture: "#c97828",
  petrol: "#a67c54", "scooty-rental": "#3c8f92", stays: "#5b8ba0", rides: "#6a7c8f",
  outing: "#8e6b9a", dinner: "#c98840", "fun-activity": "#8264c8", sports: "#4ea87d",
  salon: "#c486a8", personal: "#7d9fb5", vices: "#b85c6b", booze: "#c76a74",
  cigarettes: "#9a7c5c", "cook-maid": "#d884a8", family: "#8f7aa0", "random-expense": "#8a8a8a",
  rent: "#4a9fd4", salary: "#5a9c4e", investments: "#5a7848", banks: "#3b7da8",
  brokerage: "#4a8a68", "passed-on": "#9a9a9a", "from-home": "#6fa87a", "self-transfer": "#8b8b8b",
  other: "#7a7a7a",
};

const categoryDark: Record<string, string> = {
  food: "#c4d4a8", shopping: "#a8d4c0", travel: "#a0c8d8", grocery: "#c8d8a4",
  healthcare: "#d4b0c4", pharmacy: "#dcc4d4", household: "#a8d4b8", furniture: "#ffd966",
  petrol: "#d4b498", "scooty-rental": "#7dd3d8", stays: "#a8d0d8", rides: "#b8c4d4",
  outing: "#c8a8d4", dinner: "#ffc966", "fun-activity": "#b8a0e8", sports: "#88d4a8",
  salon: "#e8b0d4", personal: "#b8c8d4", vices: "#e0a4b4", booze: "#e8b8c0",
  cigarettes: "#d4b598", "cook-maid": "#f0b8d8", family: "#d4b8d8", "random-expense": "#c4c4c4",
  rent: "#88c8e8", salary: "#a0e090", investments: "#a8c494", banks: "#88b8d8",
  brokerage: "#a0d4a8", "passed-on": "#d0d0d0", "from-home": "#a8d4a8", "self-transfer": "#c4c4c4",
  other: "#b0b0b0",
};

/** Colours for categories you add, picked by name so each keeps its colour. */
const EXTRA_LIGHT = ["#7a6a9a", "#5a8a7a", "#9a6a5a", "#5a7a9a", "#8a8a4a", "#9a5a7a"];
const EXTRA_DARK = ["#c8b8e8", "#a8d8c8", "#e8b8a8", "#a8c8e8", "#d8d8a8", "#e8a8c8"];

export interface Theme {
  dark: boolean;
  c: Palette;
  categoryColor(slug: string | null | undefined): string;
}

function makeTheme(isDark: boolean): Theme {
  const map = isDark ? categoryDark : categoryLight;
  const extra = isDark ? EXTRA_DARK : EXTRA_LIGHT;
  return {
    dark: isDark,
    c: isDark ? dark : light,
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

export const fonts = {
  sans: "Inter_400Regular",
  sansMedium: "Inter_500Medium",
  sansSemi: "Inter_600SemiBold",
  display: "BricolageGrotesque_600SemiBold",
  displayBold: "BricolageGrotesque_700Bold",
  mono: "JetBrainsMono_400Regular",
  monoMedium: "JetBrainsMono_500Medium",
};

export const radius = { sm: 10, md: 14, lg: 18, pill: 999 };
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 };

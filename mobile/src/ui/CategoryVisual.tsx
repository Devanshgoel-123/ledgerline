import { Image } from "expo-image";
import { SymbolView } from "expo-symbols";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { PROVIDERS } from "@/core/catalog";
import { BRAND_LOGOS } from "./brandLogos.generated";
import { fonts, useTheme } from "./theme";

import type { AndroidSymbol } from "expo-symbols";
import type { SFSymbol } from "sf-symbols-typescript";

type SymbolName = ComponentProps<typeof SymbolView>["name"];
// Typed names: a misspelt symbol fails the typecheck instead of drawing nothing.
const sym = (ios: SFSymbol, android: AndroidSymbol): SymbolName => ({ ios, android, web: android });

/** One icon per built-in category: an SF Symbol on iOS, a Material Symbol on Android. */
const CATEGORY_ICONS: Record<string, SymbolName> = {
  food: sym("fork.knife", "restaurant"),
  dinner: sym("wineglass", "restaurant_menu"),
  cafes: sym("cup.and.saucer", "local_cafe"),
  grocery: sym("cart", "shopping_cart"),
  shopping: sym("bag", "shopping_bag"),
  clothing: sym("tshirt", "checkroom"),
  electronics: sym("desktopcomputer", "devices"),
  beauty: sym("sparkles", "spa"),
  transport: sym("car", "directions_car"),
  rides: sym("car.side", "local_taxi"),
  petrol: sym("fuelpump", "local_gas_station"),
  "public-transport": sym("tram", "directions_subway"),
  "scooty-rental": sym("scooter", "two_wheeler"),
  parking: sym("parkingsign.circle", "local_parking"),
  travel: sym("airplane", "flight"),
  flights: sym("airplane.departure", "flight_takeoff"),
  trains: sym("train.side.front.car", "train"),
  stays: sym("bed.double", "hotel"),
  bills: sym("doc.text", "receipt_long"),
  electricity: sym("bolt", "bolt"),
  "mobile-recharge": sym("iphone", "smartphone"),
  internet: sym("wifi", "wifi"),
  "gas-water": sym("flame", "local_fire_department"),
  household: sym("house", "home"),
  rent: sym("key", "key"),
  "home-services": sym("wrench.and.screwdriver", "handyman"),
  furniture: sym("sofa", "chair"),
  brokerage: sym("building.2", "apartment"),
  "passed-on": sym("arrow.uturn.forward", "redo"),
  subscriptions: sym("play.rectangle", "subscriptions"),
  outing: sym("ticket", "local_activity"),
  "fun-activity": sym("film", "movie"),
  sports: sym("sportscourt", "sports_tennis"),
  healthcare: sym("cross.case", "medical_services"),
  pharmacy: sym("pills", "medication"),
  doctor: sym("stethoscope", "stethoscope"),
  fitness: sym("dumbbell", "fitness_center"),
  personal: sym("person", "person"),
  salon: sym("scissors", "content_cut"),
  "random-expense": sym("ellipsis.circle", "more_horiz"),
  education: sym("graduationcap", "school"),
  family: sym("figure.2.and.child.holdinghands", "family_restroom"),
  pets: sym("pawprint", "pets"),
  gifts: sym("gift", "redeem"),
  vices: sym("wineglass", "wine_bar"),
  booze: sym("wineglass", "liquor"),
  cigarettes: sym("smoke", "smoking_rooms"),
  emi: sym("calendar.badge.clock", "event_repeat"),
  insurance: sym("checkmark.shield", "verified_user"),
  fees: sym("building.columns", "account_balance"),
  investments: sym("chart.line.uptrend.xyaxis", "trending_up"),
  transfers: sym("arrow.left.arrow.right", "swap_horiz"),
  "self-transfer": sym("arrow.triangle.2.circlepath", "sync_alt"),
  banks: sym("creditcard", "credit_card"),
  cash: sym("banknote", "payments"),
  income: sym("indianrupeesign.circle", "currency_rupee"),
  salary: sym("briefcase", "work"),
  "from-home": sym("heart", "favorite"),
  refunds: sym("arrow.uturn.backward", "undo"),
  interest: sym("percent", "percent"),
  "other-income": sym("plus.circle", "add_circle"),
  other: sym("square.grid.2x2", "category"),
};

const CUSTOM_ICON = sym("tag", "sell");

export function categoryIcon(slug: string | null | undefined): SymbolName {
  return (slug && CATEGORY_ICONS[slug]) || (slug ? CUSTOM_ICON : CATEGORY_ICONS.other!);
}

/** A colour at a given opacity, for tinted icon wells. */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** A category's icon in a soft well of its colour. */
export function CategoryIcon({ slug, size = 40 }: { slug: string | null | undefined; size?: number }) {
  const { categoryColor, dark } = useTheme();
  const color = categoryColor(slug);
  return (
    <View
      style={[
        s.well,
        { width: size, height: size, borderRadius: Math.round(size * 0.3), backgroundColor: tint(color, dark ? 0.2 : 0.12) },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <SymbolView name={categoryIcon(slug)} size={Math.round(size * 0.48)} tintColor={color} />
    </View>
  );
}

// Brand names and aliases to provider ids, for entries saved before a provider id was stored.
const BY_NAME = new Map<string, string>();
for (const provider of PROVIDERS) {
  for (const name of [provider.canonicalName, ...provider.aliases]) {
    const key = name.trim().toLowerCase();
    if (key.length >= 3 && !BY_NAME.has(key)) BY_NAME.set(key, provider.id);
  }
}

/** The bundled logo for a payment, if its shop or app is one Ledgerline knows. */
export function brandLogo(providerId: string | null | undefined, merchant?: string | null): number | null {
  if (providerId && BRAND_LOGOS[providerId]) return BRAND_LOGOS[providerId]!;
  const id = merchant ? BY_NAME.get(merchant.trim().toLowerCase()) : undefined;
  return id && BRAND_LOGOS[id] ? BRAND_LOGOS[id]! : null;
}

/**
 * What a payment shows at the start of its row: the brand's logo when
 * Ledgerline knows the shop, otherwise its category icon.
 */
export function MerchantAvatar({
  providerId,
  merchant,
  categorySlug,
  size = 40,
}: {
  providerId?: string | null;
  merchant?: string | null;
  categorySlug: string | null | undefined;
  size?: number;
}) {
  const { c } = useTheme();
  const logo = brandLogo(providerId, merchant);
  if (!logo) return <CategoryIcon slug={categorySlug} size={size} />;
  const r = Math.round(size * 0.3);
  return (
    <View
      style={[s.logo, { width: size, height: size, borderRadius: r, borderColor: c.border, backgroundColor: "#ffffff" }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Image source={logo} style={{ width: size, height: size }} contentFit="cover" transition={0} />
    </View>
  );
}

/**
 * A category to tap: its icon in a well, the name underneath. Chosen, the
 * well fills with the category's colour.
 */
export function CategoryTile({
  slug,
  label,
  selected,
  onPress,
  width = 76,
}: {
  slug: string;
  label: string;
  selected: boolean;
  onPress: () => void;
  width?: number | `${number}%`;
}) {
  const { c, categoryColor, dark, onCategory } = useTheme();
  const color = categoryColor(slug);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={({ pressed }) => [s.tile, { width, opacity: pressed ? 0.6 : 1 }]}>
      <View
        style={[
          s.tileWell,
          { backgroundColor: selected ? color : tint(color, dark ? 0.2 : 0.12), borderColor: selected ? color : "transparent" },
        ]}>
        <SymbolView name={categoryIcon(slug)} size={22} tintColor={selected ? onCategory : color} />
      </View>
      <Text
        style={[s.tileLabel, { color: selected ? c.foreground : c.muted, fontFamily: selected ? fonts.sansSemi : fonts.sansMedium }]}
        numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  tile: { alignItems: "center", gap: 6, paddingVertical: 4 },
  tileWell: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  tileLabel: { fontSize: 12, lineHeight: 15, textAlign: "center" },
  well: { alignItems: "center", justifyContent: "center" },
  logo: { overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
});

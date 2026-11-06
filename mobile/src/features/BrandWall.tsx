import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { categoryTree, PROVIDERS, rootCategory, type Category } from "@/core/catalog";
import { Card, CardTitle, Divider } from "@/ui/components";
import { brandLogo, CategoryIcon, MerchantAvatar } from "@/ui/CategoryVisual";
import { fonts, space, useTheme } from "@/ui/theme";

/** Logos a category shows before "Show all". Two rows of four. */
const FOLDED = 8;

/** Names most people know, shown first in their category; the rest follow A to Z. */
const FEATURED = [
  "Swiggy", "Zomato", "Dominos", "McDonald's", "KFC", "Starbucks", "Burger King", "Pizza Hut",
  "Blinkit", "Zepto", "Instamart", "BigBasket", "DMart", "JioMart", "Amazon Fresh",
  "Amazon", "Flipkart", "Myntra", "Ajio", "Meesho", "Nykaa", "Croma", "Apple", "Zudio", "Decathlon", "IKEA",
  "Uber", "Ola", "Rapido", "Indian Oil", "Bharat Petroleum", "HP Petrol", "Shell", "Jio-bp", "Nayara Energy", "FASTag",
  "IndiGo", "Air India", "IRCTC", "MakeMyTrip", "redBus", "Airbnb", "OYO", "Booking.com", "Emirates",
  "Airtel", "Jio", "Vodafone Idea", "Tata Play", "ACT Fibernet",
  "Netflix", "Prime Video", "JioHotstar", "Spotify", "YouTube Premium", "Apple Services", "ChatGPT", "Claude", "Google One", "X Premium",
  "BookMyShow", "PVR INOX", "District",
  "Apollo Pharmacy", "PharmEasy", "Tata 1mg", "Practo", "Cult.fit",
  "Zerodha", "Groww", "Upstox", "Angel One", "Dhan", "INDmoney", "Kuvera", "CoinDCX",
  "HDFC Bank", "SBI", "ICICI Bank", "Axis Bank", "Kotak Mahindra Bank", "CRED", "American Express", "SBI Card",
  "LIC", "Policybazaar", "ACKO", "HDFC Life", "Bajaj Finserv",
];
const RANK = new Map(FEATURED.map((name, index) => [name, index]));
const byFame = (a: { canonicalName: string }, b: { canonicalName: string }) =>
  (RANK.get(a.canonicalName) ?? Infinity) - (RANK.get(b.canonicalName) ?? Infinity) ||
  a.canonicalName.localeCompare(b.canonicalName, "en", { sensitivity: "base" });

interface BrandGroup {
  category: Category;
  brands: { id: string; name: string; slug: string }[];
}

/**
 * The shops and apps Ledgerline recognises, under their categories, so you
 * can see at a glance what gets its logo and category on its own.
 */
export function BrandWall({ categories }: { categories: Category[] }) {
  const { c } = useTheme();
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const groups = useMemo<BrandGroup[]>(() => {
    const builtIn = categories.filter((category) => !category.custom);
    const byRoot = new Map<string, BrandGroup["brands"]>();
    const seenLogos = new Set<number>();
    const sorted = [...PROVIDERS].sort(byFame);
    for (const provider of sorted) {
      const logo = brandLogo(provider.id);
      // One tile per logo: Airtel and Airtel Payments are the same mark.
      if (!logo || !provider.categorySlug || seenLogos.has(logo)) continue;
      seenLogos.add(logo);
      const root = rootCategory(provider.categorySlug, builtIn);
      const list = byRoot.get(root) ?? [];
      list.push({ id: provider.id, name: provider.canonicalName, slug: provider.categorySlug });
      byRoot.set(root, list);
    }
    return categoryTree(builtIn)
      .map(({ parent }) => ({ category: parent, brands: byRoot.get(parent.slug) ?? [] }))
      .filter((group) => group.brands.length > 0);
  }, [categories]);

  const total = groups.reduce((sum, group) => sum + group.brands.length, 0);
  const toggle = (slug: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  return (
    <Card>
      <CardTitle
        title="Shops and apps we recognise"
        sub={`${total} brands get their logo and category on their own, from a statement, a bank SMS or a name you type.`}
      />
      {groups.map(({ category, brands }, index) => {
        const expanded = open.has(category.slug);
        const shown = expanded ? brands : brands.slice(0, FOLDED);
        const more = brands.length - FOLDED;
        return (
          <View key={category.slug} style={{ gap: space[3] }}>
            {index ? <Divider /> : null}
            <View style={s.head}>
              <CategoryIcon slug={category.slug} size={28} />
              <Text style={[s.headLabel, { color: c.foreground }]} accessibilityRole="header">
                {category.label}
              </Text>
              <Text style={[s.count, { color: c.muted }]}>{brands.length}</Text>
            </View>
            <View style={s.grid}>
              {shown.map((brand) => (
                <View key={brand.id} style={s.cell} accessible accessibilityLabel={brand.name}>
                  <MerchantAvatar providerId={brand.id} categorySlug={brand.slug} size={48} />
                  <Text style={[s.name, { color: c.muted }]} numberOfLines={1}>
                    {brand.name}
                  </Text>
                </View>
              ))}
            </View>
            {more > 0 ? (
              <Pressable
                onPress={() => toggle(category.slug)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                hitSlop={8}
                style={({ pressed }) => [s.more, { opacity: pressed ? 0.6 : 1 }]}>
                <Text style={[s.moreLabel, { color: c.primary }]}>
                  {expanded ? "Show fewer" : `Show all ${brands.length}`}
                </Text>
              </Pressable>
            ) : null}
          </View>
        );
      })}
    </Card>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: space[2] },
  headLabel: { flex: 1, fontFamily: fonts.sansSemi, fontSize: 15 },
  count: { fontFamily: fonts.sansMedium, fontSize: 13, fontVariant: ["tabular-nums"] },
  // Four to a row on every phone width; the name truncates rather than wraps.
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: space[3] },
  cell: { width: "25%", alignItems: "center", gap: 6, paddingHorizontal: 2 },
  name: { fontFamily: fonts.sansMedium, fontSize: 11, lineHeight: 14, textAlign: "center", alignSelf: "stretch" },
  more: { alignSelf: "flex-start", paddingVertical: 2 },
  moreLabel: { fontFamily: fonts.sansSemi, fontSize: 14 },
});

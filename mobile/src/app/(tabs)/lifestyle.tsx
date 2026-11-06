import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { groupCategorySpend } from "@/core/analytics";
import { categoryLabel } from "@/core/catalog";
import { formatInr, formatMonthTitle } from "@/core/format";
import { MonthSwitcher, SampleNotice, useMonthAnalytics } from "@/features/common";
import { useLedger } from "@/state/ledger";
import { Card, CardTitle, Divider, Empty, PageHeader, Screen, T } from "@/ui/components";
import { CategoryBar, MonthBars } from "@/ui/charts";
import { Icon } from "@/ui/Icon";
import { fonts, space, useTheme } from "@/ui/theme";

export default function LifestyleScreen() {
  const { c, categoryColor } = useTheme();
  const { categories } = useLedger();
  const result = useMonthAnalytics();
  const groups = groupCategorySpend(result.categorySpend ?? [], categories);
  const biggest = Math.max(...groups.map((group) => group.total), 1);
  const total = result.summary.totalSpent;
  const [open, setOpen] = useState<string | null>(null);
  const trend = result.monthlySpend ?? [];
  const previous = trend.at(-2)?.total ?? 0;
  const change = previous > 0 ? ((trend.at(-1)?.total ?? 0) - previous) / previous : null;
  const shops = result.merchantSpend.filter((shop) => shop.total > 0).slice(0, 10);

  const showCategory = (slug: string) =>
    router.push({ pathname: "/transactions", params: { category: slug } });

  return (
    <Screen>
      <PageHeader eyebrow="Lifestyle" title="Where it went" sub="What kind of life is your spending creating?" />
      <MonthSwitcher />
      <SampleNotice />

      <Card>
        <CardTitle title="Category breakdown" sub={`Adds up to ${formatInr(total)} spent, rent included, less refunds`} />
        {groups.length ? (
          groups.map((group, index) => {
            const expanded = open === group.slug;
            return (
              <View key={group.slug} style={{ gap: space[2] }}>
                {index ? <Divider /> : null}
                <Pressable
                  onPress={() => (group.children.length ? setOpen(expanded ? null : group.slug) : showCategory(group.slug))}
                  accessibilityRole="button"
                  accessibilityLabel={`${categoryLabel(group.slug, categories)}, ${formatInr(group.total)}, ${pct(group.total, total)}`}
                  accessibilityHint={group.children.length ? (expanded ? "Hides the breakdown" : "Shows what's inside") : "Shows these payments"}
                  accessibilityState={group.children.length ? { expanded } : undefined}
                  style={{ paddingTop: index ? space[2] : 0, gap: 4 }}>
                  <CategoryBar
                    label={categoryLabel(group.slug, categories)}
                    total={group.total}
                    share={group.total / biggest}
                    color={categoryColor(group.slug)}
                  />
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <T variant="small" tone="muted">
                      {group.count} {group.count === 1 ? "payment" : "payments"}
                      {group.children.length ? ` · ${expanded ? "hide" : "show"} ${group.children.length} inside` : ""}
                    </T>
                    <T variant="monoSmall" tone="muted">
                      {pct(group.total, total)}
                    </T>
                  </View>
                </Pressable>
                {expanded ? (
                  <View style={[s.children, { borderColor: c.border }]}>
                    {[{ slug: group.slug, total: group.total - group.children.reduce((sum, child) => sum + child.total, 0), count: 0 }, ...group.children]
                      .filter((child) => Math.abs(child.total) >= 0.005)
                      .map((child) => (
                        <Pressable
                          key={child.slug}
                          onPress={() => showCategory(child.slug)}
                          accessibilityRole="button"
                          accessibilityLabel={`${categoryLabel(child.slug, categories)}, ${formatInr(child.total)}`}
                          style={s.childRow}>
                          <View style={[s.dot, { backgroundColor: categoryColor(child.slug) }]} />
                          <Text style={[s.childLabel, { color: c.foreground }]}>
                            {child.slug === group.slug ? `${categoryLabel(child.slug, categories)} (general)` : categoryLabel(child.slug, categories)}
                          </Text>
                          <Text style={[s.childAmount, { color: c.foreground }]}>{formatInr(child.total)}</Text>
                          <Icon name="chevron" size={12} color={c.muted2} />
                        </Pressable>
                      ))}
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <Empty title="No spending this month" body="Categories show up here once you add expenses." />
        )}
      </Card>

      <Card>
        <CardTitle
          title="Spending trend"
          sub={
            change == null
              ? "The last six months"
              : `${Math.abs(change * 100).toFixed(0)}% ${change >= 0 ? "higher" : "lower"} than last month`
          }
        />
        <MonthBars months={trend} />
        {trend
          .filter((row) => row.total > 0)
          .reverse()
          .slice(0, 3)
          .map((row) => (
            <View key={row.month} style={s.trendRow}>
              <T>{formatMonthTitle(row.month)}</T>
              <T variant="mono">{formatInr(row.total)}</T>
            </View>
          ))}
      </Card>

      <Card>
        <CardTitle title="Apps and shops" sub="Where the money went, by who you paid" />
        {shops.length ? (
          shops.map((shop, index) => (
            <View key={`${shop.merchant}-${shop.categorySlug}`}>
              {index ? <Divider /> : null}
              <View style={s.shopRow}>
                <View style={[s.mark, { backgroundColor: categoryColor(shop.categorySlug) }]} />
                <View style={{ flex: 1 }}>
                  <T variant="strong" numberOfLines={1}>
                    {shop.merchant}
                  </T>
                  <T variant="small" tone="muted">
                    {categoryLabel(shop.categorySlug, categories)} · {shop.count} {shop.count === 1 ? "payment" : "payments"}
                  </T>
                </View>
                <T variant="mono">{formatInr(shop.total)}</T>
              </View>
            </View>
          ))
        ) : (
          <Empty title="No shops yet" body="Name who you paid when you add an expense, and they show up here." />
        )}
      </Card>
    </Screen>
  );
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return "";
  return `${Math.round((part / whole) * 100)}%`;
}

const s = StyleSheet.create({
  children: { borderLeftWidth: 2, marginLeft: 3, paddingLeft: space[3], gap: 2 },
  childRow: { flexDirection: "row", alignItems: "center", gap: space[2], minHeight: 40 },
  childLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 14 },
  childAmount: { fontFamily: fonts.mono, fontSize: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  trendRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  shopRow: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 52, paddingVertical: 6 },
  mark: { width: 10, height: 32, borderRadius: 3 },
});

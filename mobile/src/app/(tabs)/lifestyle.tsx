import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { groupCategorySpend } from "@/core/analytics";
import { categoryLabel } from "@/core/catalog";
import { formatInr } from "@/core/format";
import { MonthSwitcher, SampleNotice, useMonthAnalytics, useMonthDetail } from "@/features/common";
import { useLedger } from "@/state/ledger";
import { Card, Empty, PageHeader, Screen, Section, T } from "@/ui/components";
import { CategoryIcon, MerchantAvatar } from "@/ui/CategoryVisual";
import { CategoryBar, CategoryRing, MonthBars, PaceChart, SpendChart } from "@/ui/charts";
import { Icon } from "@/ui/Icon";
import { fonts, space, tabular, useTheme } from "@/ui/theme";

export default function LifestyleScreen() {
  const { c, categoryColor } = useTheme();
  const { categories, month, dailyLimit } = useLedger();
  const result = useMonthAnalytics();
  const detail = useMonthDetail();
  const labelOf = (slug: string) => categoryLabel(slug, categories);
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
      <PageHeader title="Insights" right={<MonthSwitcher />} />
      <SampleNotice />

      <Section title="This month so far">
        <Card>
          <PaceChart month={month} days={detail.days} previous={detail.previous} />
        </Card>
      </Section>

      {groups.length ? (
        <Section title="Categories">
          <Card>
            <CategoryRing groups={groups} total={total} month={month} labelOf={labelOf} categoryColor={categoryColor} />
          </Card>
          <Card style={{ gap: 0, paddingVertical: space[2] }}>
            {groups.map((group, index) => {
              const expanded = open === group.slug;
              return (
                <View key={group.slug}>
                  {index ? <View style={[s.inset, { backgroundColor: c.border }]} /> : null}
                  <Pressable
                    onPress={() => (group.children.length ? setOpen(expanded ? null : group.slug) : showCategory(group.slug))}
                    accessibilityRole="button"
                    accessibilityLabel={`${categoryLabel(group.slug, categories)}, ${formatInr(group.total)}, ${pct(group.total, total)}`}
                    accessibilityHint={group.children.length ? (expanded ? "Hides the breakdown" : "Shows what's inside") : "Shows these payments"}
                    accessibilityState={group.children.length ? { expanded } : undefined}
                    style={({ pressed }) => [s.groupRow, { opacity: pressed ? 0.6 : 1 }]}>
                    <CategoryBar
                      slug={group.slug}
                      label={categoryLabel(group.slug, categories)}
                      total={group.total}
                      share={group.total / biggest}
                      percent={total > 0 ? group.total / total : undefined}
                      color={categoryColor(group.slug)}
                      index={index}
                    />
                  </Pressable>
                  {expanded ? (
                    <View style={{ paddingLeft: 48, paddingBottom: space[2] }}>
                      {[{ slug: group.slug, total: group.total - group.children.reduce((sum, child) => sum + child.total, 0), count: 0 }, ...group.children]
                        .filter((child) => Math.abs(child.total) >= 0.005)
                        .map((child) => (
                          <Pressable
                            key={child.slug}
                            onPress={() => showCategory(child.slug)}
                            accessibilityRole="button"
                            accessibilityLabel={`${categoryLabel(child.slug, categories)}, ${formatInr(child.total)}`}
                            style={({ pressed }) => [s.childRow, { opacity: pressed ? 0.6 : 1 }]}>
                            <CategoryIcon slug={child.slug} size={28} />
                            <Text style={[s.childLabel, { color: c.foreground }]} numberOfLines={1}>
                              {child.slug === group.slug ? `${categoryLabel(child.slug, categories)}, general` : categoryLabel(child.slug, categories)}
                            </Text>
                            <Text style={[s.childAmount, { color: c.foreground }]}>{formatInr(child.total)}</Text>
                            <Icon name="chevron" size={12} color={c.muted2} />
                          </Pressable>
                        ))}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </Card>
          <T variant="small" tone="muted" style={{ paddingHorizontal: 2 }}>
            {`${formatInr(total)} spent, rent included, refunds taken off. Tap a category for its payments.`}
          </T>
        </Section>
      ) : (
        <Card>
          <Empty title="No spending this month" body="Categories show up here once you add expenses." />
        </Card>
      )}

      <Section title="Daily spend">
        <Card>
          <SpendChart month={month} days={detail.days} limit={dailyLimit} labelOf={labelOf} categoryColor={categoryColor} />
        </Card>
      </Section>

      <Section title="Six months">
        <Card>
          {change != null ? (
            <T variant="small" tone="muted">
              {`${Math.abs(change * 100).toFixed(0)}% ${change >= 0 ? "more" : "less"} than last month`}
            </T>
          ) : null}
          <MonthBars months={trend} current={month} />
        </Card>
      </Section>

      {shops.length ? (
        <Section title="Top shops and apps">
          <Card style={{ gap: 0, paddingVertical: space[2] }}>
            {shops.map((shop, index) => (
              <View key={`${shop.merchant}-${shop.categorySlug}`}>
                {index ? <View style={[s.inset, { backgroundColor: c.border }]} /> : null}
                <View style={s.shopRow}>
                  <MerchantAvatar merchant={shop.merchant} categorySlug={shop.categorySlug} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[s.shopName, { color: c.foreground }]} numberOfLines={1}>
                      {shop.merchant}
                    </Text>
                    <Text style={[s.shopMeta, { color: c.muted }]} numberOfLines={1}>
                      {`${categoryLabel(shop.categorySlug, categories)} · ${shop.count} ${shop.count === 1 ? "payment" : "payments"}`}
                    </Text>
                  </View>
                  <Text style={[s.shopAmount, { color: c.foreground }]}>{formatInr(shop.total)}</Text>
                </View>
              </View>
            ))}
          </Card>
        </Section>
      ) : null}
    </Screen>
  );
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return "";
  return `${Math.round((part / whole) * 100)}%`;
}

const s = StyleSheet.create({
  inset: { height: StyleSheet.hairlineWidth, marginLeft: 48 },
  groupRow: { paddingVertical: space[3] },
  childRow: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 44 },
  childLabel: { flex: 1, fontFamily: fonts.sans, fontSize: 14 },
  childAmount: { fontFamily: fonts.sansMedium, fontSize: 14, ...tabular },
  shopRow: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 60, paddingVertical: 8 },
  shopName: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 20 },
  shopMeta: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 17 },
  shopAmount: { fontFamily: fonts.sansSemi, fontSize: 15, ...tabular },
});

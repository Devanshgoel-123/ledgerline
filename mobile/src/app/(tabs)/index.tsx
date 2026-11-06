import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { groupCategorySpend } from "@/core/analytics";
import { categoryLabel } from "@/core/catalog";
import { currentMonth, daysSince, today } from "@/core/dates";
import { formatInr, formatMonthShort, formatMonthTitle, formatShortDate } from "@/core/format";
import { EntryRow, MonthSwitcher, SampleNotice, useMonthAnalytics } from "@/features/common";
import { useLedger } from "@/state/ledger";
import { Button, Card, Empty, Screen, Section, T } from "@/ui/components";
import { CategoryBar } from "@/ui/charts";
import { Icon, type IconName } from "@/ui/Icon";
import { fonts, radius, space, tabular, useTheme } from "@/ui/theme";

/** A statement check older than this many days earns a reminder on Overview. */
const STATEMENT_NUDGE_DAYS = 25;

function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function OverviewScreen() {
  const { c, categoryColor } = useTheme();
  const { entries, month, dailyLimit, lastCheck, ready, categories } = useLedger();
  const result = useMonthAnalytics();
  const { summary } = result;
  const isThisMonth = month === currentMonth();
  const todaySpent = isThisMonth ? (result.daily.find((day) => day.date === today())?.amount ?? 0) : 0;
  const monthEntries = entries.filter((entry) => entry.date.startsWith(month));
  const groups = groupCategorySpend(result.categorySpend ?? [], categories).slice(0, 5);
  const biggest = Math.max(...groups.map((group) => group.total), 1);

  const daysSinceCheck = lastCheck ? daysSince(lastCheck.checkedAt) : null;
  const toReview = entries.filter((entry) => entry.needsReview).length;
  const nudgeStatement =
    ready && entries.length >= 5 && (daysSinceCheck === null || daysSinceCheck >= STATEMENT_NUDGE_DAYS);

  return (
    <Screen>
      <View style={s.header}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[s.greeting, { color: c.muted }]}>{greeting()}</Text>
          <Text style={[s.pageTitle, { color: c.foreground }]} accessibilityRole="header">
            Overview
          </Text>
        </View>
        <MonthSwitcher />
      </View>
      <SampleNotice />

      <Hero
        total={summary.totalSpent}
        today={todaySpent}
        avg={summary.avgDailySpend}
        received={summary.totalReceived}
        limit={isThisMonth ? dailyLimit : null}
        showToday={isThisMonth}
        month={month}
      />

      <View style={s.actions}>
        <Button label="Add expense" icon="add" onPress={() => router.push("/quick")} style={{ flex: 1 }} />
        <Button label="Statement" icon="statement" variant="secondary" onPress={() => router.push("/statement")} style={{ flex: 1 }} />
      </View>

      {toReview ? (
        <Prompt
          icon="bell"
          title={`${toReview} new from bank messages`}
          body="Already counted. Check the categories."
          onPress={() => router.push("/review")}
        />
      ) : nudgeStatement ? (
        <Prompt
          icon="statement"
          title={daysSinceCheck === null ? "Check your first statement" : "Time for this month's statement"}
          body={daysSinceCheck === null ? "Find payments you haven't added." : `Last checked ${daysSinceCheck} days ago.`}
          onPress={() => router.push("/statement")}
        />
      ) : null}

      {ready && entries.length === 0 ? (
        <Card>
          <Empty
            title="Start with today"
            body="Add what you spend as it happens. Once a month, upload your bank statement to catch anything you missed."
          />
        </Card>
      ) : null}

      {groups.length ? (
        <Section title="Where it went" action="All categories" onAction={() => router.push("/lifestyle")}>
          <Card style={{ gap: space[4] }}>
            {groups.map((group) => (
              <CategoryBar
                key={group.slug}
                slug={group.slug}
                label={categoryLabel(group.slug, categories)}
                total={group.total}
                share={group.total / biggest}
                percent={summary.totalSpent > 0 ? group.total / summary.totalSpent : undefined}
                color={categoryColor(group.slug)}
              />
            ))}
            <Button label={`Share ${formatMonthShort(month)} on X`} icon="share" variant="secondary" onPress={() => router.push("/share-month")} />
          </Card>
        </Section>
      ) : null}

      {monthEntries.length ? (
        <Section
          title="Recent"
          action={monthEntries.length > 6 ? "See all" : undefined}
          onAction={() => router.push("/transactions")}>
          <Card style={{ gap: 0, paddingVertical: space[2] }}>
            {monthEntries.slice(0, 6).map((entry, index) => (
              <View key={entry.id}>
                {index ? <View style={[s.inset, { backgroundColor: c.border }]} /> : null}
                <EntryRow entry={entry} />
              </View>
            ))}
          </Card>
        </Section>
      ) : ready && entries.length ? (
        <Card>
          <Empty title={`Nothing in ${formatMonthTitle(month)}`} body="Add an expense, or upload that month's statement." />
        </Card>
      ) : null}

      {lastCheck ? (
        <T variant="small" tone="muted" style={{ textAlign: "center" }}>
          {`Last statement: ${lastCheck.bank}, ${formatShortDate(lastCheck.dateFrom)} to ${formatShortDate(lastCheck.dateTo)}`}
        </T>
      ) : null}
    </Screen>
  );
}

/** One quiet, tappable line that asks for something: review messages, check a statement. */
function Prompt({ icon, title, body, onPress }: { icon: IconName; title: string; body: string; onPress: () => void }) {
  const { c } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${body}`}
      style={({ pressed }) => [s.prompt, { backgroundColor: c.primarySoft, opacity: pressed ? 0.7 : 1 }]}>
      <View style={[s.promptIcon, { backgroundColor: c.surface }]}>
        <Icon name={icon} size={18} color={c.primary} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[s.promptTitle, { color: c.foreground }]}>{title}</Text>
        <Text style={[s.promptBody, { color: c.muted }]}>{body}</Text>
      </View>
      <Icon name="chevron" size={14} color={c.muted} />
    </Pressable>
  );
}

function Hero({
  total,
  today: todaySpent,
  avg,
  received,
  limit,
  showToday,
  month,
}: {
  total: number;
  today: number;
  avg: number;
  received: number;
  limit: number | null;
  showToday: boolean;
  month: string;
}) {
  const { c } = useTheme();
  const progress = limit ? Math.min(1, todaySpent / limit) : 0;
  const over = Boolean(limit && todaySpent > limit);
  // The gradient is drawn at the card's measured size; SVG percentages don't
  // track a flex parent reliably.
  const [size, setSize] = useState({ width: 0, height: 0 });
  return (
    <View
      style={[s.hero, { backgroundColor: c.heroFrom }]}
      accessibilityRole="summary"
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== size.width || height !== size.height) setSize({ width, height });
      }}>
      <Svg style={StyleSheet.absoluteFill} width={size.width} height={size.height}>
        <Defs>
          <LinearGradient id="hero" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={c.heroFrom} />
            <Stop offset="1" stopColor={c.heroTo} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={size.width} height={size.height} fill="url(#hero)" />
      </Svg>
      <View style={s.heroTop}>
        <Text style={[s.heroLabel, { color: c.onHeroMuted }]}>
          {showToday ? "Spent this month" : `Spent in ${formatMonthTitle(month)}`}
        </Text>
        <Pressable
          onPress={() =>
            Alert.alert(
              "What counts as spent",
              "Includes rent. Refunds lower it. Investments, transfers between your own accounts and friends' shares of a split bill are left out.",
            )
          }
          accessibilityRole="button"
          accessibilityLabel="What counts as spent"
          hitSlop={12}>
          <Icon name="info" size={18} color={c.onHeroMuted} />
        </Pressable>
      </View>
      <Text
        style={[s.heroAmount, tabular, { color: c.onHero }]}
        adjustsFontSizeToFit
        numberOfLines={1}
        accessibilityLabel={`Spent ${formatInr(total)}`}>
        {formatInr(total)}
      </Text>
      <View style={[s.heroStats, { borderTopColor: c.heroTrack }]}>
        {showToday ? <HeroStat label="Today" value={formatInr(todaySpent)} /> : null}
        <HeroStat label="Daily avg" value={formatInr(avg)} />
        <HeroStat label="Money in" value={formatInr(received)} />
      </View>
      {limit && showToday ? (
        <View style={{ gap: 6 }}>
          <View style={[s.track, { backgroundColor: c.heroTrack }]}>
            <View style={[s.fill, { width: `${Math.max(3, progress * 100)}%`, backgroundColor: over ? c.heroWarn : c.onHero }]} />
          </View>
          <Text style={[s.heroSmall, { color: c.onHeroMuted }]}>
            {over
              ? `${formatInr(todaySpent - limit)} over today's ${formatInr(limit)} limit`
              : `${formatInr(limit - todaySpent)} left of today's ${formatInr(limit)}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  const { c } = useTheme();
  return (
    <View style={s.heroStat}>
      <Text style={[s.heroSmall, { color: c.onHeroMuted }]}>{label}</Text>
      <Text style={[s.heroStatValue, tabular, { color: c.onHero }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", gap: space[3] },
  greeting: { fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 18 },
  pageTitle: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8 },
  hero: { borderRadius: radius.xl, padding: 20, gap: space[1], overflow: "hidden" },
  heroStats: { flexDirection: "row", marginTop: space[3], paddingTop: space[3], borderTopWidth: StyleSheet.hairlineWidth },
  heroStat: { flex: 1, gap: 2 },
  heroStatValue: { fontFamily: fonts.sansSemi, fontSize: 15, lineHeight: 20 },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLabel: { fontFamily: fonts.sansMedium, fontSize: 14 },
  heroAmount: { fontFamily: fonts.displayBold, fontSize: 40, lineHeight: 48, letterSpacing: -1.2 },
  heroSmall: { fontFamily: fonts.sansMedium, fontSize: 12.5 },
  track: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: space[3] },
  fill: { height: "100%", borderRadius: 2 },
  actions: { flexDirection: "row", gap: space[3] },
  inset: { height: StyleSheet.hairlineWidth, marginLeft: 52 },
  prompt: { flexDirection: "row", alignItems: "center", gap: space[3], borderRadius: radius.lg, padding: space[3], minHeight: 64 },
  promptIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  promptTitle: { fontFamily: fonts.sansSemi, fontSize: 15, lineHeight: 20 },
  promptBody: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 17 },
});

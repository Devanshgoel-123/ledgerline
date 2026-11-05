import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { groupCategorySpend } from "@/core/analytics";
import { categoryLabel } from "@/core/catalog";
import { currentMonth, daysSince, today } from "@/core/dates";
import { formatInr, formatMonthTitle, formatShortDate } from "@/core/format";
import { EntryRow, MonthSwitcher, SampleNotice, useMonthAnalytics } from "@/features/common";
import { useLedger } from "@/state/ledger";
import { Button, Card, CardTitle, Divider, Empty, Eyebrow, Notice, Screen, T } from "@/ui/components";
import { CategoryBar, DailyBars } from "@/ui/charts";
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
  const groups = groupCategorySpend(result.categorySpend ?? [], categories).slice(0, 4);
  const biggest = Math.max(...groups.map((group) => group.total), 1);

  const daysSinceCheck = lastCheck ? daysSince(lastCheck.checkedAt) : null;
  const toReview = entries.filter((entry) => entry.needsReview).length;
  const nudgeStatement =
    ready && entries.length >= 5 && (daysSinceCheck === null || daysSinceCheck >= STATEMENT_NUDGE_DAYS);

  return (
    <Screen>
      <View style={{ gap: 2 }}>
        <Eyebrow>{greeting()}</Eyebrow>
        <Text style={[s.pageTitle, { color: c.foreground }]} accessibilityRole="header">
          Your money
        </Text>
      </View>
      <MonthSwitcher />
      <SampleNotice />

      <Hero
        total={summary.totalSpent}
        today={todaySpent}
        avg={summary.avgDailySpend}
        limit={isThisMonth ? dailyLimit : null}
        showToday={isThisMonth}
        month={month}
      />

      <View style={s.actions}>
        <ActionTile
          icon="add"
          title="Add expense"
          sub="Takes two seconds"
          primary
          onPress={() => router.push("/quick")}
        />
        <ActionTile
          icon="statement"
          title="Upload statement"
          sub="Find what you missed"
          onPress={() => router.push("/statement")}
        />
      </View>

      {toReview ? (
        <Notice
          tone="info"
          title={`${toReview} new ${toReview === 1 ? "payment" : "payments"} from your bank messages.`}
          body="Already counted. Take a quick look at the categories."
          action={<Button label="Review" icon="check" onPress={() => router.push("/review")} />}
        />
      ) : null}

      {nudgeStatement ? (
        <Notice
          tone="info"
          title={daysSinceCheck === null ? "Check your first statement." : "Time for this month's statement."}
          body={
            daysSinceCheck === null
              ? "Upload a bank statement PDF and Ledgerline lists the payments you haven't added. It's read on this phone."
              : `Your last check was ${daysSinceCheck} days ago. Upload the latest one to catch anything you missed.`
          }
          action={<Button label="Upload statement" icon="statement" variant="secondary" onPress={() => router.push("/statement")} />}
        />
      ) : null}

      {ready && entries.length === 0 ? (
        <Card>
          <Empty
            title="Start with today"
            body="Add what you spend as it happens. Once a month, upload your bank statement and add anything you missed."
          />
        </Card>
      ) : null}

      <View style={s.pair}>
        <Card style={s.half}>
          <Eyebrow>Money in</Eyebrow>
          <Text style={[s.stat, tabular, { color: c.credit }]} adjustsFontSizeToFit numberOfLines={1}>
            {formatInr(summary.totalReceived)}
          </Text>
          <T variant="small" tone="muted">salary and other credits</T>
        </Card>
        <Card style={s.half}>
          <Eyebrow>Daily limit</Eyebrow>
          {dailyLimit ? (
            <>
              <Text style={[s.stat, tabular, { color: c.foreground }]} adjustsFontSizeToFit numberOfLines={1}>
                {formatInr(dailyLimit)}
              </Text>
              <T variant="small" tone={result.dailyInsights.daysOverLimit.length ? "danger" : "muted"}>
                {result.dailyInsights.daysOverLimit.length
                  ? `Over on ${result.dailyInsights.daysOverLimit.length} ${result.dailyInsights.daysOverLimit.length === 1 ? "day" : "days"}`
                  : result.dailyInsights.totalDaysWithSpend
                    ? "Under it every day"
                    : "Nothing spent yet"}
              </T>
            </>
          ) : (
            <Pressable onPress={() => router.push("/settings")} accessibilityRole="button" style={{ gap: 2 }}>
              <Text style={[s.stat, { color: c.primary }]}>Set one</Text>
              <T variant="small" tone="muted">See days you went over</T>
            </Pressable>
          )}
        </Card>
      </View>

      {groups.length ? (
        <Card>
          <CardTitle
            title="Where it went"
            right={
              <Pressable onPress={() => router.push("/lifestyle")} accessibilityRole="button" hitSlop={8} style={s.link}>
                <Text style={[s.linkText, { color: c.primary }]}>All categories</Text>
              </Pressable>
            }
          />
          {groups.map((group) => (
            <CategoryBar
              key={group.slug}
              label={categoryLabel(group.slug, categories)}
              total={group.total}
              share={group.total / biggest}
              color={categoryColor(group.slug)}
            />
          ))}
        </Card>
      ) : null}

      <Card>
        <CardTitle title="Daily spend" sub="Rent left out. Tap a bar for the day." />
        <DailyBars month={month} daily={result.daily} limit={dailyLimit} />
      </Card>

      <Card>
        <CardTitle
          title="Recent"
          sub={monthEntries.length ? `${monthEntries.length} this month` : undefined}
          right={
            monthEntries.length > 5 ? (
              <Pressable onPress={() => router.push("/transactions")} accessibilityRole="button" hitSlop={8} style={s.link}>
                <Text style={[s.linkText, { color: c.primary }]}>See all</Text>
              </Pressable>
            ) : undefined
          }
        />
        {monthEntries.length ? (
          <View>
            {monthEntries.slice(0, 5).map((entry, index) => (
              <View key={entry.id}>
                {index ? <Divider /> : null}
                <EntryRow entry={entry} />
              </View>
            ))}
          </View>
        ) : (
          <Empty title="Nothing added this month" body="Tap Add expense as you spend, or upload a statement to fill the gaps." />
        )}
      </Card>

      {lastCheck ? (
        <T variant="small" tone="muted" style={{ textAlign: "center" }}>
          {`Last statement: ${lastCheck.bank}, ${formatShortDate(lastCheck.dateFrom)} to ${formatShortDate(lastCheck.dateTo)}`}
        </T>
      ) : null}
    </Screen>
  );
}

function Hero({
  total,
  today: todaySpent,
  avg,
  limit,
  showToday,
  month,
}: {
  total: number;
  today: number;
  avg: number;
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
      <Text style={[s.heroSub, { color: c.onHeroMuted }]}>
        {showToday ? `${formatInr(todaySpent)} today · ${formatInr(avg)}/day average` : `${formatInr(avg)}/day average`}
      </Text>
      {limit && showToday ? (
        <View style={{ gap: 6 }}>
          <View style={s.track}>
            <View style={[s.fill, { width: `${Math.max(3, progress * 100)}%`, backgroundColor: over ? "#fecaca" : c.onHero }]} />
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

function ActionTile({
  icon,
  title,
  sub,
  primary,
  onPress,
}: {
  icon: IconName;
  title: string;
  sub: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const { c } = useTheme();
  const fg = primary ? c.primaryForeground : c.foreground;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={sub}
      style={({ pressed }) => [
        s.tile,
        {
          backgroundColor: primary ? c.primary : c.surface,
          borderColor: primary ? c.primary : c.border,
          transform: [{ scale: pressed ? 0.98 : 1 }],
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <View style={[s.tileIcon, { backgroundColor: primary ? "rgba(255,255,255,0.18)" : c.primarySoft }]}>
        <Icon name={icon} size={20} color={primary ? c.primaryForeground : c.primary} />
      </View>
      <View style={{ gap: 1 }}>
        <Text style={[s.tileTitle, { color: fg }]}>{title}</Text>
        <Text style={[s.tileSub, { color: primary ? c.primaryForeground : c.muted, opacity: primary ? 0.85 : 1 }]}>{sub}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  pageTitle: { fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 35, letterSpacing: -0.6 },
  hero: { borderRadius: radius.xl, padding: 20, gap: space[2], overflow: "hidden" },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  heroLabel: { fontFamily: fonts.sansSemi, fontSize: 14 },
  heroAmount: { fontFamily: fonts.displayBold, fontSize: 46, lineHeight: 54, letterSpacing: -1 },
  heroSub: { fontFamily: fonts.sansMedium, fontSize: 14 },
  heroSmall: { fontFamily: fonts.sansMedium, fontSize: 12.5 },
  track: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.25)", overflow: "hidden", marginTop: space[2] },
  fill: { height: "100%", borderRadius: 4 },
  actions: { flexDirection: "row", gap: space[3] },
  tile: { flex: 1, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, padding: space[4], gap: space[3], minHeight: 112 },
  tileIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tileTitle: { fontFamily: fonts.sansSemi, fontSize: 16 },
  tileSub: { fontFamily: fonts.sans, fontSize: 13 },
  stat: { fontFamily: fonts.displayBold, fontSize: 24, lineHeight: 30 },
  pair: { flexDirection: "row", gap: space[3] },
  half: { flex: 1 },
  link: { minHeight: 32, justifyContent: "center" },
  linkText: { fontFamily: fonts.sansSemi, fontSize: 14 },
});

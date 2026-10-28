import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { formatInr, formatMonthTitle, formatShortDate } from "@/core/format";
import { AddButton, EntryRow, MonthSwitcher, SampleNotice, useMonthAnalytics } from "@/features/common";
import { useLedger } from "@/state/ledger";
import { Button, Card, CardTitle, Divider, Empty, Eyebrow, PageHeader, Pill, Screen, T } from "@/ui/components";
import { DailyBars } from "@/ui/charts";
import { fonts, space, useTheme } from "@/ui/theme";

export default function OverviewScreen() {
  const { c } = useTheme();
  const { entries, month, dailyLimit, lastCheck, ready } = useLedger();
  const result = useMonthAnalytics();
  const { summary } = result;
  const monthEntries = entries.filter((entry) => entry.date.startsWith(month));
  const subline = [
    `${formatInr(summary.totalSpent)} spent`,
    summary.totalInvested ? `${formatInr(summary.totalInvested)} invested` : null,
    `${formatInr(summary.totalReceived)} in`,
    `${summary.transactionCount} payments`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Screen>
      <PageHeader eyebrow="Overview" title={formatMonthTitle(month)} sub={subline} right={<AddButton />} />
      <MonthSwitcher />
      <SampleNotice />

      {ready && entries.length === 0 ? <FirstRun /> : null}

      <Card>
        <Eyebrow>Total spent</Eyebrow>
        <Text style={[s.hero, { color: c.copper }]} accessibilityLabel={`Total spent ${formatInr(summary.totalSpent)}`}>
          {formatInr(summary.totalSpent)}
        </Text>
        <T variant="small" tone="muted">
          includes rent, less refunds{"\n"}investments stay off this number and the daily chart
        </T>
        <View style={s.pills}>
          <Pill>{`${summary.transactionCount} payments`}</Pill>
          {summary.upiPayees ? <Pill>{`${summary.upiPayees} UPI payees`}</Pill> : null}
          <Pill>{`Avg ${formatInr(summary.avgDailySpend)}/day`}</Pill>
        </View>
      </Card>

      <View style={s.pair}>
        <Card style={s.half}>
          <Eyebrow>Avg / day</Eyebrow>
          <Text style={[s.stat, { color: c.foreground }]}>{formatInr(summary.avgDailySpend)}</Text>
          <T variant="small" tone="muted">across days you spent · rent left out</T>
        </Card>
        <Card style={s.half}>
          <Eyebrow>Money in</Eyebrow>
          <Text style={[s.stat, { color: c.credit }]}>{formatInr(summary.totalReceived)}</Text>
          <T variant="small" tone="muted">salary and other credits · refunds lower spend instead</T>
        </Card>
      </View>

      <Card>
        <Eyebrow>Daily limit</Eyebrow>
        {dailyLimit ? (
          <>
            <Text style={[s.stat, { color: c.foreground }]}>{formatInr(dailyLimit)} a day</Text>
            <T variant="small" tone="muted">
              {result.dailyInsights.daysOverLimit.length
                ? `Over on ${result.dailyInsights.daysOverLimit.length} ${result.dailyInsights.daysOverLimit.length === 1 ? "day" : "days"}, by ${formatInr(result.dailyInsights.totalOverLimit)} in all.`
                : result.dailyInsights.totalDaysWithSpend
                  ? "Under it every day you spent. Nice."
                  : "Nothing spent yet this month."}
            </T>
          </>
        ) : (
          <>
            <Text style={[s.stat, { color: c.foreground }]}>Not set</Text>
            <T variant="small" tone="muted">Pick the most you want to spend in a day. Days over it show on the chart.</T>
            <Button label="Set a limit" variant="secondary" onPress={() => router.push("/settings")} />
          </>
        )}
      </Card>

      <Card>
        <CardTitle
          title="Daily spend"
          sub={`${formatInr(result.daily.reduce((sum, day) => sum + day.amount, 0))} by day · rent left out`}
        />
        <DailyBars month={month} daily={result.daily} limit={dailyLimit} />
      </Card>

      <Card>
        <CardTitle
          title="Anything missing?"
          sub={
            lastCheck
              ? `Last checked a ${lastCheck.bank} statement for ${formatShortDate(lastCheck.dateFrom)} to ${formatShortDate(lastCheck.dateTo)}. ${lastCheck.missingCount ? `${lastCheck.missingCount} were missing then.` : "Nothing was missing."}`
              : "Upload your bank statement PDF and Ledgerline lists the payments you haven't added. It's read on this phone and never uploaded."
          }
        />
        <Button label="Check a statement" icon="statement" variant="secondary" onPress={() => router.push("/statement")} />
      </Card>

      <Card>
        <CardTitle title="Recent" sub={monthEntries.length ? `${monthEntries.length} this month` : undefined} />
        {monthEntries.length ? (
          <View>
            {monthEntries.slice(0, 5).map((entry, index) => (
              <View key={entry.id}>
                {index ? <Divider /> : null}
                <EntryRow entry={entry} />
              </View>
            ))}
            {monthEntries.length > 5 ? (
              <Button label="See all transactions" variant="ghost" onPress={() => router.push("/transactions")} />
            ) : null}
          </View>
        ) : (
          <Empty title="Nothing added this month" body="Add what you spend as you go, or check a statement to fill the gaps." />
        )}
      </Card>
    </Screen>
  );
}

function FirstRun() {
  return (
    <Card>
      <CardTitle
        title="Start with today"
        sub="Add what you spend as it happens. Once a month, check your bank statement and add anything you missed."
      />
      <Button label="Add an expense" icon="add" onPress={() => router.push("/add")} />
      <Button label="Check a statement" icon="statement" variant="secondary" onPress={() => router.push("/statement")} />
    </Card>
  );
}

const s = StyleSheet.create({
  hero: { fontFamily: fonts.monoMedium, fontSize: 44, lineHeight: 52, letterSpacing: -1 },
  stat: { fontFamily: fonts.monoMedium, fontSize: 22, lineHeight: 28 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
  pair: { flexDirection: "row", gap: space[3] },
  half: { flex: 1 },
});

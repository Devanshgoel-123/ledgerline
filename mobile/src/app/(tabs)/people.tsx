import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { formatInr, formatMonthTitle, formatShortDate } from "@/core/format";
import { friendBalances } from "@/core/people";
import { AddButton, MonthSwitcher, useMonthAnalytics } from "@/features/common";
import { setShareSettled, settleFriend } from "@/db/repo";
import { useLedger } from "@/state/ledger";
import { Button, Card, CardTitle, Divider, Empty, PageHeader, Screen, T } from "@/ui/components";
import { Icon } from "@/ui/Icon";
import { fonts, radius, space, useTheme } from "@/ui/theme";

export default function PeopleScreen() {
  const { c } = useTheme();
  const { entries, month, db, refresh } = useLedger();
  const balances = friendBalances(entries);
  const owedTotal = balances.reduce((sum, friend) => sum + friend.owed, 0);
  const result = useMonthAnalytics();
  const [open, setOpen] = useState<string | null>(null);

  const settleAll = (name: string, owed: number) =>
    Alert.alert(`Did ${name} pay you back?`, `Marks ${formatInr(owed)} as paid back.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Paid back",
        onPress: async () => {
          await settleFriend(db, name);
          await refresh();
        },
      },
    ]);

  return (
    <Screen>
      <PageHeader
        eyebrow="People"
        title={owedTotal > 0 ? `${formatInr(owedTotal)} owed to you` : "Friends and family"}
        sub="Bills you split, and money that moved between you and people."
        right={<AddButton label="Split" href="/add" />}
      />

      <Card>
        <CardTitle
          title="Split bills"
          sub="When you pay for a group, add the bill and split it. Only your share counts as your spending."
        />
        {balances.length ? (
          balances.map((friend, index) => {
            const expanded = open === friend.name;
            return (
              <View key={friend.name} style={{ gap: space[2] }}>
                {index ? <Divider /> : null}
                <Pressable
                  onPress={() => setOpen(expanded ? null : friend.name)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${friend.name}, ${friend.owed > 0 ? `owes you ${formatInr(friend.owed)}` : "all paid back"}`}
                  style={s.friend}>
                  <View style={[s.avatar, { backgroundColor: c.primarySoft }]}>
                    <Text style={[s.avatarText, { color: c.primary }]}>{friend.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T variant="strong">{friend.name}</T>
                    <T variant="small" tone="muted">
                      {friend.bills.length} {friend.bills.length === 1 ? "bill" : "bills"}
                      {friend.settled ? ` · ${formatInr(friend.settled)} paid back` : ""}
                    </T>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <T variant="mono" tone={friend.owed > 0 ? "accent" : "muted"}>
                      {friend.owed > 0 ? formatInr(friend.owed) : "Settled"}
                    </T>
                    {friend.owed > 0 ? (
                      <T variant="small" tone="muted">
                        owes you
                      </T>
                    ) : null}
                  </View>
                </Pressable>
                {expanded ? (
                  <View style={[s.bills, { backgroundColor: c.bgMuted }]}>
                    {friend.bills.map((bill) => (
                      <Pressable
                        key={`${bill.entryId}-${bill.amount}`}
                        onPress={async () => {
                          await setShareSettled(db, bill.entryId, friend.name, !bill.settledAt);
                          await refresh();
                        }}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: Boolean(bill.settledAt) }}
                        accessibilityLabel={`${bill.description}, ${formatShortDate(bill.date)}, ${formatInr(bill.amount)}, ${bill.settledAt ? "paid back" : "not paid back"}`}
                        style={s.bill}>
                        <View style={[s.check, { borderColor: c.borderStrong, backgroundColor: bill.settledAt ? c.success : "transparent" }]}>
                          {bill.settledAt ? <Icon name="check" size={14} color={c.surface} /> : null}
                        </View>
                        <View style={{ flex: 1 }}>
                          <T numberOfLines={1}>{bill.description}</T>
                          <T variant="small" tone="muted">
                            {formatShortDate(bill.date)} · {bill.settledAt ? "paid back" : "not paid back yet"}
                          </T>
                        </View>
                        <T variant="mono" tone={bill.settledAt ? "muted" : "default"}>
                          {formatInr(bill.amount)}
                        </T>
                      </Pressable>
                    ))}
                    {friend.owed > 0 ? (
                      <Button label={`${friend.name} paid me back`} variant="secondary" onPress={() => settleAll(friend.name, friend.owed)} />
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <Empty title="No split bills yet" body="Add an expense and turn on Split with friends. Who owes what shows up here." />
        )}
      </Card>

      <MonthSwitcher />
      <Card>
        <CardTitle title="People you paid" sub={`${formatMonthTitle(month)} · from the person you name on each payment`} />
        {result.payeeSpend.length ? (
          result.payeeSpend.map((person, index) => (
            <View key={person.name}>
              {index ? <Divider /> : null}
              <View style={s.friend}>
                <View style={[s.avatar, { backgroundColor: c.bgMuted }]}>
                  <Text style={[s.avatarText, { color: c.foreground }]}>{person.name.slice(0, 1).toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <T variant="strong">{person.name}</T>
                  <T variant="small" tone="muted">
                    Paid {formatInr(person.paid)}
                    {person.received ? ` · received ${formatInr(person.received)}` : ""}
                  </T>
                </View>
                <T variant="mono" tone={person.total > 0 ? "debit" : "credit"}>
                  {person.total > 0 ? `−${formatInr(person.total)}` : `+${formatInr(-person.total)}`}
                </T>
              </View>
            </View>
          ))
        ) : (
          <Empty title="No one this month" body='When you add a payment, fill in "Paid to" with a name, like Mom or Kabir.' />
        )}
      </Card>
    </Screen>
  );
}

const s = StyleSheet.create({
  friend: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56, paddingVertical: 6 },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { fontFamily: fonts.sansSemi, fontSize: 16 },
  bills: { borderRadius: radius.md, padding: space[3], gap: space[2] },
  bill: { flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48 },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
});

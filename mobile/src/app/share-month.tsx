import { useMemo, useState } from "react";
import { Linking, Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { groupCategorySpend } from "@/core/analytics";
import { categoryLabel } from "@/core/catalog";
import { formatMonthTitle } from "@/core/format";
import { buildMonthPost, X_LIMIT, xComposeUrl, xLength } from "@/core/shareMonth";
import { useMonthAnalytics } from "@/features/common";
import { closeModal } from "@/features/navigation";
import { useLedger } from "@/state/ledger";
import { Button, Card, Empty, Row, T, Toggle } from "@/ui/components";
import { Icon } from "@/ui/Icon";
import { fonts, space, useTheme } from "@/ui/theme";

/** Share the month you're looking at on X: category shares, amounts only if you choose. */
export default function ShareMonthScreen() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { month, categories } = useLedger();
  const { summary, categorySpend } = useMonthAnalytics();
  const [showAmounts, setShowAmounts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(
    () =>
      groupCategorySpend(categorySpend ?? [], categories).map((group) => ({
        slug: group.slug,
        label: categoryLabel(group.slug, categories),
        total: group.total,
      })),
    [categorySpend, categories],
  );
  const monthTitle = formatMonthTitle(month);
  const post = buildMonthPost({
    monthTitle,
    totalSpent: summary.totalSpent,
    avgDailySpend: summary.avgDailySpend,
    groups,
    showAmounts,
  });
  const length = xLength(post);

  const postOnX = async () => {
    setError(null);
    try {
      await Linking.openURL(xComposeUrl(post));
    } catch {
      setError("Couldn't open X. Use Share another way and pick X from the list.");
    }
  };

  const shareElsewhere = async () => {
    setError(null);
    try {
      await Share.share({ message: post });
    } catch {
      setError("Couldn't open the share sheet.");
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={[s.top, { paddingTop: Platform.OS === "android" ? insets.top + space[2] : space[4], borderColor: c.border }]}>
        <Pressable onPress={() => closeModal()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={s.close}>
          <Icon name="close" size={20} color={c.foreground} />
        </Pressable>
        <Text style={[s.topTitle, { color: c.foreground }]} accessibilityRole="header">
          Share {monthTitle}
        </Text>
        <View style={s.close} />
      </View>
      <ScrollView contentContainerStyle={{ padding: space[4], gap: space[4], paddingBottom: insets.bottom + space[6] }}>
        {groups.length === 0 ? (
          <Card>
            <Empty title={`Nothing spent in ${monthTitle}`} body="Add some expenses first, then share where the money went." />
          </Card>
        ) : (
          <>
            <View style={[s.post, { backgroundColor: c.surface, borderColor: c.border }]}>
              <View style={s.postHead}>
                <View style={[s.avatar, { backgroundColor: c.foreground }]}>
                  <Text style={[s.avatarX, { color: c.bg }]}>𝕏</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.postWho, { color: c.foreground }]}>Your post</Text>
                  <Text style={[s.postMeta, { color: c.muted }]}>Preview. You can edit it in X before posting.</Text>
                </View>
              </View>
              <Text style={[s.postText, { color: c.foreground }]} selectable>
                {post}
              </Text>
              <Text
                style={[s.counter, { color: length > X_LIMIT ? c.danger : c.muted }]}
                accessibilityLabel={`${length} of ${X_LIMIT} characters`}>
                {length}/{X_LIMIT}
              </Text>
            </View>

            <Card>
              <Row
                title="Show amounts"
                sub={showAmounts ? "Rupee totals are in the post." : "Only percentages. Nobody sees how much you spend."}
                right={<Toggle value={showAmounts} onValueChange={setShowAmounts} accessibilityLabel="Show amounts" />}
              />
            </Card>

            <View style={{ gap: space[2] }}>
              <Button label="Post on X" icon="share" onPress={postOnX} />
              <Button label="Share another way" variant="secondary" onPress={shareElsewhere} />
              {error ? (
                <T variant="small" tone="danger" style={{ textAlign: "center" }}>
                  {error}
                </T>
              ) : null}
            </View>
            <T variant="small" tone="muted" style={{ textAlign: "center" }}>
              Ledgerline doesn&apos;t post anything. X opens with the text filled in, and you decide.
            </T>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: space[3],
    paddingBottom: space[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  topTitle: { fontFamily: fonts.display, fontSize: 18 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  post: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 20, padding: space[4], gap: space[3] },
  postHead: { flexDirection: "row", alignItems: "center", gap: space[3] },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarX: { fontSize: 20, fontWeight: "700" },
  postWho: { fontFamily: fonts.sansSemi, fontSize: 15 },
  postMeta: { fontFamily: fonts.sans, fontSize: 12 },
  postText: { fontFamily: fonts.sans, fontSize: 15, lineHeight: 22 },
  counter: { fontFamily: fonts.sansMedium, fontSize: 12, alignSelf: "flex-end", fontVariant: ["tabular-nums"] },
});

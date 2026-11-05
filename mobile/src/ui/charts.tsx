import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatDayLabel, formatInr, formatInrCompact, formatMonthShort } from "@/core/format";
import { monthRange } from "@/core/dates";
import { fonts, space, useTheme } from "./theme";

const CHART_HEIGHT = 140;

/**
 * Spend per day for a month, like the web's "Daily spend". Bars are toned
 * by how they compare with your average; the tallest stands out. Tap a bar
 * to read its day and amount.
 */
export function DailyBars({
  month,
  daily,
  limit,
}: {
  month: string;
  daily: { date: string; amount: number }[];
  limit: number | null;
}) {
  const { c } = useTheme();
  const { to } = monthRange(month);
  const days = Number(to.slice(8));
  const byDay = new Map(daily.map((day) => [Number(day.date.slice(8)), day.amount]));
  const values = Array.from({ length: days }, (_, i) => byDay.get(i + 1) ?? 0);
  const spent = values.filter((value) => value > 0);
  const avg = spent.length ? spent.reduce((a, b) => a + b, 0) / spent.length : 0;
  const max = Math.max(...values, limit ?? 0, 1);
  const tallest = Math.max(...values);
  const [picked, setPicked] = useState<number | null>(null);

  const tone = (value: number) => {
    if (value <= 0) return c.chartGrid;
    if (value === tallest) return c.barPeak;
    if (limit && value > limit) return c.barHot;
    if (value > avg * 1.5) return c.barWatch;
    return c.barCalm;
  };

  const pickedValue = picked ? values[picked - 1] ?? 0 : null;
  const pickedDate = picked ? `${month}-${String(picked).padStart(2, "0")}` : null;

  return (
    <View style={{ gap: space[2] }}>
      <Text style={[s.caption, { color: c.muted }]} accessibilityLiveRegion="polite">
        {pickedDate
          ? `${formatDayLabel(pickedDate)} · ${pickedValue ? formatInr(pickedValue) : "nothing spent"}`
          : spent.length
            ? `Averaging ${formatInr(avg)} on days you spent. Tap a bar for the day.`
            : "No spending this month yet."}
      </Text>
      <View style={[s.plot, { height: CHART_HEIGHT, borderColor: c.chartGrid }]}>
        {avg > 0 ? (
          <View style={[s.avgLine, { bottom: (avg / max) * CHART_HEIGHT, borderColor: c.parchmentInk }]} />
        ) : null}
        {limit ? (
          <View style={[s.avgLine, { bottom: Math.min(limit / max, 1) * CHART_HEIGHT, borderColor: c.danger, borderStyle: "dotted" }]} />
        ) : null}
        {values.map((value, index) => (
          <Pressable
            key={index}
            onPress={() => setPicked(picked === index + 1 ? null : index + 1)}
            style={s.barSlot}
            accessibilityRole="button"
            accessibilityLabel={`${formatDayLabel(`${month}-${String(index + 1).padStart(2, "0")}`)}: ${value > 0 ? formatInr(value) : "nothing spent"}`}>
            <View
              style={{
                height: value > 0 ? Math.max(3, (value / max) * CHART_HEIGHT) : 2,
                backgroundColor: tone(value),
                borderRadius: 3,
                opacity: picked && picked !== index + 1 ? 0.45 : 1,
              }}
            />
          </Pressable>
        ))}
      </View>
      <View style={s.axis}>
        {[1, 8, 15, 22, days].map((day) => (
          <Text key={day} style={[s.tick, { color: c.muted2 }]}>
            {day}
          </Text>
        ))}
      </View>
      <View style={s.legend}>
        <Legend color={c.barCalm} label="Typical" />
        <Legend color={c.barWatch} label="Above average" />
        {limit ? <Legend color={c.barHot} label="Over limit" /> : null}
        <Legend color={c.barPeak} label="Tallest" />
      </View>
    </View>
  );
}

/** Spend per month, oldest to newest; the tallest stands out. */
export function MonthBars({ months }: { months: { month: string; total: number }[] }) {
  const { c } = useTheme();
  const max = Math.max(...months.map((row) => row.total), 1);
  const tallest = Math.max(...months.map((row) => row.total));
  return (
    <View style={{ gap: space[2] }}>
      <View style={[s.plot, { height: 110, borderColor: c.chartGrid, gap: space[3] }]}>
        {months.map((row) => (
          <View
            key={row.month}
            style={{ flex: 1, justifyContent: "flex-end", alignItems: "center", gap: 4 }}
            accessible
            accessibilityLabel={`${row.month}: ${formatInr(row.total)}`}>
            <Text style={[s.tick, { color: c.muted }]}>{row.total > 0 ? formatInrCompact(row.total) : ""}</Text>
            <View
              style={{
                width: "70%",
                height: row.total > 0 ? Math.max(3, (row.total / max) * 80) : 2,
                borderRadius: 4,
                backgroundColor: row.total > 0 && row.total === tallest ? c.barPeak : row.total > 0 ? c.barCalm : c.chartGrid,
              }}
            />
          </View>
        ))}
      </View>
      <View style={[s.axis, { gap: space[3] }]}>
        {months.map((row) => (
          <Text key={row.month} style={[s.tick, { color: c.muted2, flex: 1, textAlign: "center" }]}>
            {formatMonthShort(row.month)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** One category line: name, a track showing its share, amount and percent. */
export function CategoryBar({
  label,
  total,
  share,
  color,
}: {
  label: string;
  total: number;
  /** 0 to 1, of the biggest category. */
  share: number;
  color: string;
}) {
  const { c } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space[2] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
          <Text style={[s.label, { color: c.foreground }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Text style={[s.amount, { color: c.foreground }]}>{formatInr(total)}</Text>
      </View>
      <View style={[s.track, { backgroundColor: c.bgMuted }]}>
        <View
          style={{
            width: `${Math.max(2, Math.min(1, share) * 100)}%`,
            height: "100%",
            borderRadius: 3,
            backgroundColor: color,
          }}
        />
      </View>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Text style={[s.tick, { color: c.muted, fontSize: 12 }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  caption: { fontFamily: fonts.sans, fontSize: 13 },
  plot: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  barSlot: { flex: 1, height: "100%", justifyContent: "flex-end" },
  avgLine: { position: "absolute", left: 0, right: 0, borderTopWidth: 1, borderStyle: "dashed" },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  tick: { fontFamily: fonts.mono, fontSize: 11 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: space[3] },
  label: { fontFamily: fonts.sansMedium, fontSize: 15 },
  amount: { fontFamily: fonts.monoMedium, fontSize: 15 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
});

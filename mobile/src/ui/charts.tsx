import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop } from "react-native-svg";
import type { DaySpend } from "@/core/analytics";
import { chartScale, runningTotals } from "@/core/chartScale";
import { currentMonth, monthRange, shiftMonth, today } from "@/core/dates";
import { formatDayLabel, formatInr, formatInrCompact, formatMonthShort } from "@/core/format";
import { CategoryIcon } from "./CategoryVisual";
import { Grow, useCountUp } from "./motion";
import { fonts, motion, space, tabular, useTheme } from "./theme";

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const ease = Easing.bezier(...motion.bezier);

/** Plays 0 → 1 on mount and again whenever `key` changes. */
function useProgress(key: string, delay = 0) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, { duration: 900, easing: ease }));
  }, [key, delay, progress]);
  return progress;
}

/** A smooth line through points that never swings past them (x-midpoint cubics). */
export function smoothPath(points: { x: number; y: number }[]): string {
  if (!points.length) return "";
  let d = `M${points[0]!.x},${points[0]!.y}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const mid = (a.x + b.x) / 2;
    d += ` C${mid},${a.y} ${mid},${b.y} ${b.x},${b.y}`;
  }
  return d;
}

/* ───────────────────────── Daily spend, by category ───────────────────────── */

const PLOT = 150;
const HEAD = 20;

/**
 * Spend per day for a month, each bar stacked in its categories' colours.
 * One outsized day is clipped (with a break and its real amount) so the rest
 * stay readable. Tap a bar for its day; tap again to let go.
 */
export function SpendChart({
  month,
  days,
  limit,
  labelOf,
  categoryColor,
}: {
  month: string;
  days: DaySpend[];
  limit: number | null;
  labelOf: (slug: string) => string;
  categoryColor: (slug: string) => string;
}) {
  const { c } = useTheme();
  const { to } = monthRange(month);
  const length = Number(to.slice(8));
  const lastDay = month === currentMonth() ? Number(today().slice(8)) : length;
  const byDay = useMemo(() => new Map(days.map((day) => [Number(day.date.slice(8)), day])), [days]);
  const totals = days.map((day) => day.total);
  const scale = chartScale(totals);
  const avg = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
  // The tapped day belongs to its month, so switching months lets go of it.
  const [tap, setTap] = useState<{ month: string; day: number } | null>(null);
  const picked = tap?.month === month ? tap.day : null;
  const setPicked = (day: number | null) => setTap(day == null ? null : { month, day });

  const legend = useMemo(() => {
    const sums = new Map<string, number>();
    for (const day of days) for (const part of day.parts) sums.set(part.slug, (sums.get(part.slug) ?? 0) + part.total);
    return [...sums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([slug]) => slug);
  }, [days]);

  const y = (value: number) => Math.min(1, value / scale.max) * PLOT;
  const grid = Array.from({ length: Math.round(scale.max / scale.step) }, (_, i) => (i + 1) * scale.step);
  const pickedDay = picked ? byDay.get(picked) : null;
  const highest = days.reduce<DaySpend | null>((best, day) => (!best || day.total > best.total ? day : best), null);

  return (
    <View style={{ gap: space[3] }}>
      <View style={s.readout} accessibilityLiveRegion="polite">
        {picked ? (
          <>
            <View style={s.readoutHead}>
              <Text style={[s.readoutLabel, { color: c.muted }]}>
                {formatDayLabel(`${month}-${String(picked).padStart(2, "0")}`)}
              </Text>
              <Text style={[s.readoutValue, { color: c.foreground }]}>{pickedDay ? formatInr(pickedDay.total) : "Nothing spent"}</Text>
            </View>
            <View style={s.parts}>
              {(pickedDay?.parts ?? []).slice(0, 3).map((part) => (
                <View key={part.slug} style={s.part}>
                  <View style={[s.dot, { backgroundColor: categoryColor(part.slug) }]} />
                  <Text style={[s.partText, { color: c.muted }]} numberOfLines={1}>
                    {`${labelOf(part.slug)} ${formatInr(part.total)}`}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : days.length ? (
          <>
            <View style={s.readoutHead}>
              <Text style={[s.readoutLabel, { color: c.muted }]}>Average day</Text>
              <Text style={[s.readoutValue, { color: c.foreground }]}>{formatInr(avg)}</Text>
            </View>
            {highest ? (
              <Text style={[s.partText, { color: c.muted }]}>
                {`Highest ${formatInr(highest.total)} on ${formatDayLabel(highest.date)}. Tap a bar for its day.`}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[s.partText, { color: c.muted }]}>No spending this month yet</Text>
        )}
      </View>

      <View style={{ flexDirection: "row" }}>
        <View style={{ flex: 1, height: PLOT + HEAD, justifyContent: "flex-end" }}>
          {grid.map((value) => (
            <View key={value} style={[s.gridLine, { bottom: y(value), backgroundColor: c.chartGrid }]} />
          ))}
          {avg > 0 && avg <= scale.max ? <View style={[s.refLine, { bottom: y(avg), borderColor: c.muted2 }]} /> : null}
          {limit && limit <= scale.max ? (
            <View style={[s.refLine, { bottom: y(limit), borderColor: c.danger, borderStyle: "dotted" }]} />
          ) : null}
          <View style={[s.bars, { height: PLOT, borderColor: c.borderStrong }]}>
            {Array.from({ length }, (_, index) => {
              const dayNumber = index + 1;
              const day = byDay.get(dayNumber);
              const future = dayNumber > lastDay;
              const clipped = Boolean(day && day.total > scale.max);
              const over = Boolean(limit && day && day.total > limit);
              const dim = picked != null && picked !== dayNumber;
              const date = `${month}-${String(dayNumber).padStart(2, "0")}`;
              return (
                <Pressable
                  key={dayNumber}
                  onPress={() => setPicked(picked === dayNumber ? null : dayNumber)}
                  disabled={future}
                  style={s.slot}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDayLabel(date)}: ${day ? formatInr(day.total) : "nothing spent"}`}>
                  {day ? (
                    <>
                      {clipped ? (
                        <View style={[s.clipLabel, { bottom: PLOT + 3 }]} pointerEvents="none">
                          <Text style={[s.clipText, { color: c.foreground }]}>{formatInrCompact(day.total)}</Text>
                        </View>
                      ) : null}
                      <Grow
                        to={Math.max(4, y(day.total))}
                        delay={Math.min(index, 30) * 14}
                        style={[
                          s.bar,
                          { opacity: dim ? 0.3 : 1 },
                          over ? { borderWidth: 1.5, borderColor: c.danger } : null,
                        ]}>
                        {day.parts.map((part) => (
                          <View key={part.slug} style={{ flex: part.total, backgroundColor: categoryColor(part.slug) }} />
                        ))}
                        {clipped ? (
                          <View style={s.breakWrap}>
                            <View style={[s.break, { backgroundColor: c.surface }]} />
                            <View style={[s.break, { backgroundColor: c.surface }]} />
                          </View>
                        ) : null}
                      </Grow>
                    </>
                  ) : (
                    <View style={[s.stub, { backgroundColor: c.chartGrid, opacity: future ? 0.5 : 1 }]} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={{ width: 36, height: PLOT + HEAD }}>
          {grid.map((value) => (
            <Text key={value} style={[s.yLabel, { color: c.muted2, bottom: y(value) - 7 }]}>
              {formatInrCompact(value)}
            </Text>
          ))}
        </View>
      </View>

      <View style={[s.axis, { marginRight: 36 }]}>
        {[1, 8, 15, 22, length].map((day) => (
          <Text key={day} style={[s.tick, { color: day === lastDay && lastDay < length ? c.primary : c.muted2 }]}>
            {day}
          </Text>
        ))}
      </View>

      <View style={s.legend}>
        {legend.map((slug) => (
          <Legend key={slug} color={categoryColor(slug)} label={labelOf(slug)} />
        ))}
        {avg > 0 && avg <= scale.max ? <Legend color={c.muted2} label="Average" line /> : null}
        {limit ? <Legend color={c.danger} label="Over limit" outline /> : null}
      </View>
    </View>
  );
}

/* ───────────────────────── Pace: this month against last ───────────────────────── */

const PACE_H = 132;

/**
 * Running total for the month so far against the same days last month, as
 * two lines. Day-to-day spending only: rent is left out, as on the day chart.
 */
export function PaceChart({
  month,
  days,
  previous,
}: {
  month: string;
  days: DaySpend[];
  previous: { date: string; amount: number }[];
}) {
  const { c } = useTheme();
  const [width, setWidth] = useState(0);
  const length = Number(monthRange(month).to.slice(8));
  const lastDay = month === currentMonth() ? Number(today().slice(8)) : length;
  const prevLength = Number(monthRange(shiftMonth(month, -1)).to.slice(8));
  const now = runningTotals(new Map(days.map((day) => [Number(day.date.slice(8)), day.total])), lastDay);
  const before = runningTotals(new Map(previous.map((day) => [Number(day.date.slice(8)), day.amount])), Math.min(prevLength, length));
  const soFar = now.at(-1) ?? 0;
  const lastAtSameDay = before[Math.min(lastDay, before.length) - 1] ?? 0;
  const top = Math.max(soFar, before.at(-1) ?? 0, 1) * 1.08;
  const shown = useCountUp(soFar);
  const progress = useProgress(`${month}-${soFar}-${width}`, 120);

  const x = (day: number) => ((day - 1) / Math.max(1, length - 1)) * width;
  const yOf = (value: number) => PACE_H - (value / top) * (PACE_H - 8);
  const line = smoothPath(now.map((value, i) => ({ x: x(i + 1), y: yOf(value) })));
  const area = now.length ? `${line} L${x(now.length)},${PACE_H} L0,${PACE_H} Z` : "";
  const hasBefore = before.some((value) => value > 0);
  const ghost = hasBefore ? smoothPath(before.map((value, i) => ({ x: x(i + 1), y: yOf(value) }))) : "";
  const end = now.length ? { x: x(now.length), y: yOf(soFar) } : null;

  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: 1400 * (1 - progress.value) }));
  const areaProps = useAnimatedProps(() => ({ opacity: progress.value }));
  const dotProps = useAnimatedProps(() => ({ opacity: progress.value > 0.92 ? 1 : 0 }));

  const diff = soFar - lastAtSameDay;
  const compare = hasBefore
    ? `${formatInr(Math.abs(diff))} ${diff > 0 ? "more" : "less"} than by day ${lastDay} last month`
    : "Day-to-day spending, rent left out";

  return (
    <View style={{ gap: space[3] }}>
      <View style={{ gap: 2 }}>
        <Text style={[s.paceValue, { color: c.foreground }]}>{formatInr(shown)}</Text>
        <Text style={[s.partText, { color: diff > 0 && hasBefore ? c.foreground : c.muted }]}>{compare}</Text>
      </View>
      <View style={{ height: PACE_H }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 ? (
          <Svg width={width} height={PACE_H}>
            <Defs>
              <LinearGradient id="pace" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={c.primary} stopOpacity={0.32} />
                <Stop offset="1" stopColor={c.primary} stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="paceLine" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={c.aura2} />
                <Stop offset="1" stopColor={c.primary} />
              </LinearGradient>
            </Defs>
            {[0.33, 0.66].map((f) => (
              <Line key={f} x1={0} x2={width} y1={PACE_H * f} y2={PACE_H * f} stroke={c.chartGrid} strokeWidth={1} />
            ))}
            {ghost ? <Path d={ghost} stroke={c.muted2} strokeWidth={1.5} strokeDasharray="4 4" fill="none" /> : null}
            {area ? <AnimatedPath d={area} fill="url(#pace)" animatedProps={areaProps} /> : null}
            {line ? (
              <AnimatedPath
                d={line}
                stroke="url(#paceLine)"
                strokeWidth={2.5}
                strokeLinecap="round"
                fill="none"
                strokeDasharray="1400"
                animatedProps={lineProps}
              />
            ) : null}
            {end ? (
              <G>
                <AnimatedCircle cx={end.x} cy={end.y} r={9} fill={c.primary} fillOpacity={0.18} animatedProps={dotProps} />
                <AnimatedCircle cx={end.x} cy={end.y} r={4.5} fill={c.primary} stroke={c.surface} strokeWidth={2} animatedProps={dotProps} />
              </G>
            ) : null}
          </Svg>
        ) : null}
      </View>
      <View style={s.axis}>
        {[1, 8, 15, 22, length].map((day) => (
          <Text key={day} style={[s.tick, { color: c.muted2 }]}>
            {day}
          </Text>
        ))}
      </View>
      <View style={s.legend}>
        <Legend color={c.primary} label={formatMonthShort(month)} line solid />
        {hasBefore ? <Legend color={c.muted2} label={formatMonthShort(shiftMonth(month, -1))} line /> : null}
      </View>
    </View>
  );
}

/** The month's running total as a thin line, for the Overview card. */
export function Sparkline({ days, month, color, height = 40 }: { days: DaySpend[]; month: string; color: string; height?: number }) {
  const [width, setWidth] = useState(0);
  const length = Number(monthRange(month).to.slice(8));
  const lastDay = month === currentMonth() ? Number(today().slice(8)) : length;
  const now = runningTotals(new Map(days.map((day) => [Number(day.date.slice(8)), day.total])), lastDay);
  const top = Math.max(now.at(-1) ?? 0, 1);
  const progress = useProgress(`${month}-${top}-${width}`, 200);
  const x = (day: number) => ((day - 1) / Math.max(1, length - 1)) * width;
  const yOf = (value: number) => height - 3 - (value / top) * (height - 6);
  const line = smoothPath(now.map((value, i) => ({ x: x(i + 1), y: yOf(value) })));
  const area = now.length ? `${line} L${x(now.length)},${height} L0,${height} Z` : "";
  const lineProps = useAnimatedProps(() => ({ strokeDashoffset: 1200 * (1 - progress.value) }));
  const areaProps = useAnimatedProps(() => ({ opacity: progress.value }));
  if (now.every((value) => value === 0)) return null;
  return (
    <View style={{ height }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} accessible={false}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.28} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <AnimatedPath d={area} fill="url(#spark)" animatedProps={areaProps} />
          <AnimatedPath d={line} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none" strokeDasharray="1200" animatedProps={lineProps} />
        </Svg>
      ) : null}
    </View>
  );
}

/* ───────────────────────── Category ring ───────────────────────── */

/** Where the month went as one ring, a colour per category, sweeping in. */
export function CategoryRing({
  groups,
  total,
  month,
  labelOf,
  categoryColor,
}: {
  groups: { slug: string; total: number }[];
  total: number;
  month: string;
  labelOf: (slug: string) => string;
  categoryColor: (slug: string) => string;
}) {
  const { c } = useTheme();
  const size = 148;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const positive = groups.filter((group) => group.total > 0);
  const sum = positive.reduce((acc, group) => acc + group.total, 0) || 1;
  const top = positive.slice(0, 5);
  const rest = positive.slice(5).reduce((acc, group) => acc + group.total, 0);
  const segments = [...top, ...(rest > 0 ? [{ slug: "__rest", total: rest }] : [])];
  const progress = useProgress(`${month}-${sum}`, 80);
  const shown = useCountUp(total);
  let start = 0;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[5] }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.chartGrid} strokeWidth={stroke} fill="none" />
          <G transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {segments.map((segment) => {
              const length = Math.max(0, (segment.total / sum) * circumference - (segments.length > 1 ? 3 : 0));
              const offset = start;
              start += (segment.total / sum) * circumference;
              return (
                <RingSegment
                  key={segment.slug}
                  progress={progress}
                  r={r}
                  center={size / 2}
                  stroke={stroke}
                  length={length}
                  offset={offset}
                  circumference={circumference}
                  color={segment.slug === "__rest" ? c.muted2 : categoryColor(segment.slug)}
                />
              );
            })}
          </G>
        </Svg>
        <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
          <Text style={[s.ringValue, { color: c.foreground }]} adjustsFontSizeToFit numberOfLines={1}>
            {formatInrCompact(shown)}
          </Text>
          <Text style={[s.tick, { color: c.muted, fontSize: 12 }]}>spent</Text>
        </View>
      </View>
      <View style={{ flex: 1, gap: space[2] }}>
        {segments.map((segment) => (
          <View key={segment.slug} style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <View style={[s.dot, { backgroundColor: segment.slug === "__rest" ? c.muted2 : categoryColor(segment.slug) }]} />
            <Text style={[s.ringLabel, { color: c.foreground }]} numberOfLines={1}>
              {segment.slug === "__rest" ? "Everything else" : labelOf(segment.slug)}
            </Text>
            <Text style={[s.ringPct, { color: c.muted }]}>{`${Math.round((segment.total / sum) * 100)}%`}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RingSegment({
  progress,
  r,
  center,
  stroke,
  length,
  offset,
  circumference,
  color,
}: {
  progress: ReturnType<typeof useSharedValue<number>>;
  r: number;
  center: number;
  stroke: number;
  length: number;
  offset: number;
  circumference: number;
  color: string;
}) {
  const props = useAnimatedProps(() => ({
    strokeDasharray: [length * progress.value, circumference],
    strokeDashoffset: -offset * progress.value,
  }));
  return <AnimatedCircle cx={center} cy={center} r={r} stroke={color} strokeWidth={stroke} fill="none" animatedProps={props} />;
}

/* ───────────────────────── Six months ───────────────────────── */

const MONTH_PLOT = 116;

/** Spend per month, oldest to newest; the month you're looking at glows. Outliers clip. */
export function MonthBars({ months, current }: { months: { month: string; total: number }[]; current?: string }) {
  const { c } = useTheme();
  const scale = chartScale(months.map((row) => row.total));
  const focus = current ?? months.at(-1)?.month;
  const y = (value: number) => Math.min(1, value / scale.max) * MONTH_PLOT;
  return (
    <View style={{ gap: space[2] }}>
      <View style={[s.monthPlot, { height: MONTH_PLOT + HEAD, borderColor: c.borderStrong }]}>
        {months.map((row, index) => {
          const on = row.month === focus;
          const clipped = row.total > scale.max;
          return (
            <View
              key={row.month}
              style={{ flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center" }}
              accessible
              accessibilityLabel={`${formatMonthShort(row.month)}: ${formatInr(row.total)}`}>
              <Text style={[s.tick, { color: on ? c.foreground : c.muted, marginBottom: 4 }]}>
                {row.total > 0 ? formatInrCompact(row.total) : ""}
              </Text>
              <Grow
                to={row.total > 0 ? Math.max(4, y(row.total)) : 2}
                delay={index * 60}
                style={[s.monthBar, { backgroundColor: row.total > 0 ? c.barCalm : c.chartGrid }]}>
                {on && row.total > 0 ? (
                  <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
                    <Defs>
                      <LinearGradient id={`mb-${row.month}`} x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={c.aura2} />
                        <Stop offset="1" stopColor={c.primary} />
                      </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" fill={`url(#mb-${row.month})`} />
                  </Svg>
                ) : null}
                {clipped ? (
                  <View style={s.breakWrap}>
                    <View style={[s.break, { backgroundColor: c.surface }]} />
                    <View style={[s.break, { backgroundColor: c.surface }]} />
                  </View>
                ) : null}
              </Grow>
            </View>
          );
        })}
      </View>
      <View style={[s.axis]}>
        {months.map((row) => (
          <Text
            key={row.month}
            style={[s.tick, { color: row.month === focus ? c.primary : c.muted2, flex: 1, textAlign: "center" }]}>
            {formatMonthShort(row.month)}
          </Text>
        ))}
      </View>
    </View>
  );
}

/* ───────────────────────── Category line ───────────────────────── */

/** One category line: name, a track showing its share, amount and percent. */
export function CategoryBar({
  slug,
  label,
  total,
  share,
  percent,
  color,
  index = 0,
}: {
  slug: string;
  label: string;
  total: number;
  /** 0 to 1, of the biggest category. */
  share: number;
  /** Of all spending, shown next to the amount. */
  percent?: number;
  color: string;
  /** Position in the list, for a small stagger. */
  index?: number;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
      <CategoryIcon slug={slug} size={36} />
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: space[2] }}>
          <Text style={[s.label, { color: c.foreground, flex: 1 }]} numberOfLines={1}>
            {label}
          </Text>
          {percent != null ? <Text style={[s.percent, { color: c.muted }]}>{`${Math.round(percent * 100)}%`}</Text> : null}
          <Text style={[s.amount, { color: c.foreground }]}>{formatInr(total)}</Text>
        </View>
        <View style={[s.track, { backgroundColor: c.chartGrid }]}>
          <Grow to={Math.max(0.02, Math.min(1, share))} axis="x" delay={120 + index * 60} style={{ height: "100%", borderRadius: 3, backgroundColor: color }} />
        </View>
      </View>
    </View>
  );
}

function Legend({
  color,
  label,
  line,
  solid,
  outline,
}: {
  color: string;
  label: string;
  line?: boolean;
  solid?: boolean;
  outline?: boolean;
}) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      {line ? (
        <View style={{ width: 14, borderTopWidth: solid ? 2.5 : 1.5, borderStyle: solid ? "solid" : "dashed", borderColor: color }} />
      ) : outline ? (
        <View style={{ width: 10, height: 10, borderRadius: 3, borderWidth: 1.5, borderColor: color }} />
      ) : (
        <View style={[s.dot, { backgroundColor: color }]} />
      )}
      <Text style={[s.legendText, { color: c.muted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  readout: { minHeight: 44, gap: 4 },
  readoutHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: space[2] },
  readoutLabel: { fontFamily: fonts.sansMedium, fontSize: 13 },
  readoutValue: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, ...tabular },
  parts: { flexDirection: "row", flexWrap: "wrap", columnGap: space[3], rowGap: 2 },
  part: { flexDirection: "row", alignItems: "center", gap: 6, maxWidth: "100%" },
  partText: { fontFamily: fonts.sans, fontSize: 13, lineHeight: 18, ...tabular },
  bars: { flexDirection: "row", alignItems: "flex-end", gap: 2, borderBottomWidth: StyleSheet.hairlineWidth },
  slot: { flex: 1, height: "100%", justifyContent: "flex-end", alignItems: "center" },
  bar: {
    width: "100%",
    maxWidth: 14,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
    overflow: "hidden",
    flexDirection: "column-reverse",
  },
  stub: { width: "100%", maxWidth: 14, height: 2, borderRadius: 1 },
  clipLabel: { position: "absolute", width: 48, left: "50%", marginLeft: -24, alignItems: "center" },
  clipText: { fontFamily: fonts.sansSemi, fontSize: 10, ...tabular },
  breakWrap: { position: "absolute", top: 10, left: 0, right: 0, gap: 3 },
  break: { height: 2, transform: [{ skewY: "-18deg" }] },
  gridLine: { position: "absolute", left: 0, right: 0, height: StyleSheet.hairlineWidth },
  refLine: { position: "absolute", left: 0, right: 0, borderTopWidth: 1, borderStyle: "dashed" },
  yLabel: { position: "absolute", right: 0, fontFamily: fonts.mono, fontSize: 10, ...tabular },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  tick: { fontFamily: fonts.mono, fontSize: 11, ...tabular },
  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: space[3], rowGap: space[1] },
  legendText: { fontFamily: fonts.sans, fontSize: 12 },
  dot: { width: 9, height: 9, borderRadius: 3 },
  paceValue: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.4, ...tabular },
  ringValue: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26, maxWidth: 104, ...tabular },
  ringLabel: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 14 },
  ringPct: { fontFamily: fonts.sansMedium, fontSize: 13, ...tabular },
  monthPlot: { flexDirection: "row", alignItems: "flex-end", gap: space[3], borderBottomWidth: StyleSheet.hairlineWidth },
  monthBar: { width: "62%", borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: "hidden" },
  label: { fontFamily: fonts.sansMedium, fontSize: 15 },
  amount: { fontFamily: fonts.sansSemi, fontSize: 15, ...tabular },
  percent: { fontFamily: fonts.sans, fontSize: 13, ...tabular },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
});

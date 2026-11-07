import { BlurView } from "expo-blur";
import { GlassView, isLiquidGlassAvailable } from "expo-glass-effect";
import type { ReactNode } from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { radius as radii, useTheme } from "./theme";

/** iOS 26 draws real Liquid Glass; older iOS and the web blur; Android frosts. */
const LIQUID = Platform.OS === "ios" && isLiquidGlassAvailable();
const BLUR = Platform.OS === "ios" || Platform.OS === "web";

/**
 * A frosted surface over the app's backdrop. Content sits on top; `style`
 * sets padding and gap the same way a plain View would.
 */
export function Glass({
  children,
  style,
  radius = radii.lg,
  strong,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number;
  /** A denser frost, for surfaces that hold a lot of small text. */
  strong?: boolean;
}) {
  const { c, dark } = useTheme();
  const shadow = dark
    ? null
    : { shadowColor: "#0f1b2a", shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 };

  if (LIQUID) {
    return (
      <View style={[{ borderRadius: radius }, shadow]}>
        <GlassView glassEffectStyle="regular" style={[{ borderRadius: radius, overflow: "hidden" }, style]}>
          {children}
        </GlassView>
      </View>
    );
  }

  return (
    <View style={[{ borderRadius: radius }, shadow]}>
      <View style={[{ borderRadius: radius, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth, borderColor: c.glassBorder }, style]}>
        {BLUR ? <BlurView intensity={dark ? 40 : 50} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} /> : null}
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, { backgroundColor: BLUR && !strong ? c.glassFill : c.glassFillSolid }]}
        />
        {/* The lit top edge that makes it read as a pane rather than a card. */}
        <View pointerEvents="none" style={[s.edge, { backgroundColor: c.glassEdge }]} />
        {children}
      </View>
    </View>
  );
}

/**
 * The soft light behind every screen: three wide glows in the colours of
 * the hero card, fixed while the content scrolls over them.
 */
export function Backdrop() {
  const { c, dark } = useTheme();
  const strength = dark ? 0.55 : 0.42;
  const glows = [
    { id: "a1", color: c.aura1, cx: "8%", cy: "0%", rx: "85%", ry: "38%", o: strength },
    { id: "a2", color: c.aura2, cx: "100%", cy: "22%", rx: "70%", ry: "32%", o: strength * 0.8 },
    { id: "a3", color: c.aura3, cx: "20%", cy: "88%", rx: "80%", ry: "34%", o: strength * 0.45 },
  ];
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]}>
      <Svg width="100%" height="100%">
        <Defs>
          {glows.map((glow) => (
            <RadialGradient key={glow.id} id={glow.id} cx={glow.cx} cy={glow.cy} rx={glow.rx} ry={glow.ry} fx={glow.cx} fy={glow.cy}>
              <Stop offset="0" stopColor={glow.color} stopOpacity={glow.o} />
              <Stop offset="1" stopColor={glow.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {glows.map((glow) => (
          <Rect key={glow.id} x="0" y="0" width="100%" height="100%" fill={`url(#${glow.id})`} />
        ))}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  edge: { position: "absolute", top: 0, left: 12, right: 12, height: StyleSheet.hairlineWidth, opacity: 0.9 },
});

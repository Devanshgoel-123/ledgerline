import { BlurView } from "expo-blur";
import { Redirect } from "expo-router";
import { TabList, Tabs, TabSlot, TabTrigger } from "expo-router/ui";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLedger } from "@/state/ledger";
import { Icon, type IconName } from "@/ui/Icon";
import { fonts, useTheme } from "@/ui/theme";

// Browsers have no native tab bar; this draws the phone's bottom bar so the
// web build (for trying the app on a computer) looks like the app.

const TABS: { name: string; href: "/" | "/lifestyle" | "/transactions" | "/people" | "/settings"; label: string; icon: IconName }[] = [
  { name: "index", href: "/", label: "Overview", icon: "overview" },
  { name: "lifestyle", href: "/lifestyle", label: "Insights", icon: "lifestyle" },
  { name: "transactions", href: "/transactions", label: "Transactions", icon: "list" },
  { name: "people", href: "/people", label: "People", icon: "people" },
  { name: "settings", href: "/settings", label: "Settings", icon: "settings" },
];

export default function WebTabsLayout() {
  const { c, dark } = useTheme();
  const { ready, welcomed } = useLedger();
  if (ready && !welcomed) return <Redirect href="/welcome" />;
  return (
    <Tabs>
      <TabSlot />
      <TabList style={[s.bar, { borderColor: c.glassBorder }]}>
        <BlurView intensity={60} tint={dark ? "dark" : "light"} style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.glassFill }]} />
        {TABS.map((tab) => (
          <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
            <TabButton label={tab.label} icon={tab.icon} />
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}

type TabButtonProps = ComponentProps<typeof Pressable> & { label: string; icon: IconName; isFocused?: boolean };

// React 19 passes ref as a prop; TabTrigger asChild hands it to the Pressable.
function TabButton({ label, icon, isFocused, ...rest }: TabButtonProps) {
  const { c } = useTheme();
  const color = isFocused ? c.primary : c.muted;
  return (
    <Pressable {...rest} accessibilityRole="tab" accessibilityState={{ selected: Boolean(isFocused) }} style={s.tab}>
      <View style={[s.pill, isFocused && { backgroundColor: c.primarySoft }]}>
        <Icon name={icon} size={20} color={color} />
      </View>
      <Text style={[s.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingTop: 6,
    paddingBottom: 10,
  },
  tab: { flex: 1, alignItems: "center", gap: 2 },
  pill: { paddingHorizontal: 16, paddingVertical: 4, borderRadius: 999 },
  label: { fontFamily: fonts.sansMedium, fontSize: 11.5 },
});

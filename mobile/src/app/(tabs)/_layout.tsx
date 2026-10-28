import { Redirect } from "expo-router";
import { NativeTabs } from "expo-router/native-tabs";
import { useLedger } from "@/state/ledger";
import { iconFor } from "@/ui/Icon";
import { useTheme } from "@/ui/theme";

/** The web app's sections, as a bottom tab bar (Android allows five). */
export default function TabsLayout() {
  const { c } = useTheme();
  const { ready, welcomed } = useLedger();
  if (ready && !welcomed) return <Redirect href="/welcome" />;

  return (
    <NativeTabs
      backgroundColor={c.surface}
      indicatorColor={c.copperSoft}
      labelStyle={{ selected: { color: c.copper } }}
      iconColor={{ selected: c.copper }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={iconFor("overview").ios} md={iconFor("overview").android} />
        <NativeTabs.Trigger.Label>Overview</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="lifestyle">
        <NativeTabs.Trigger.Icon sf={iconFor("lifestyle").ios} md={iconFor("lifestyle").android} />
        <NativeTabs.Trigger.Label>Lifestyle</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="transactions">
        <NativeTabs.Trigger.Icon sf={iconFor("list").ios} md={iconFor("list").android} />
        <NativeTabs.Trigger.Label>Transactions</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="people">
        <NativeTabs.Trigger.Icon sf={iconFor("people").ios} md={iconFor("people").android} />
        <NativeTabs.Trigger.Label>People</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf={iconFor("settings").ios} md={iconFor("settings").android} />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

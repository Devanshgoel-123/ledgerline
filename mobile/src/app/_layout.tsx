import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_500Medium } from "@expo-google-fonts/inter/500Medium";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Inter_700Bold } from "@expo-google-fonts/inter/700Bold";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { migrate } from "@/db/schema";
import { configureNotifications, useOpenReminders } from "@/reminders/schedule";
import { AppLockGate } from "@/features/AppLock";
import { LedgerProvider } from "@/state/ledger";
import { useTheme } from "@/ui/theme";

// Deep links (widget, app shortcuts, reminders) open on top of the tabs, so
// closing Quick add or a statement check always has somewhere to go back to.
export const unstable_settings = { initialRouteName: "(tabs)" };

void SplashScreen.preventAutoHideAsync();
configureNotifications();

export default function RootLayout() {
  const { c } = useTheme();
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    // A missing font falls back to the system font rather than blocking the app.
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);

  useOpenReminders();

  if (!loaded && !error) return null;

  return (
    <SQLiteProvider databaseName="ledgerline.db" onInit={migrate as never}>
      <LedgerProvider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: c.bg },
          }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="quick"
            options={{
              presentation: "formSheet",
              sheetAllowedDetents: [0.92],
              sheetGrabberVisible: true,
              sheetCornerRadius: 22,
              contentStyle: { backgroundColor: c.bg },
            }}
          />
          <Stack.Screen name="add" options={{ presentation: "modal" }} />
          <Stack.Screen name="entry/[id]" options={{ presentation: "modal" }} />
          <Stack.Screen name="statement" options={{ presentation: "modal" }} />
          <Stack.Screen name="categories" options={{ presentation: "modal" }} />
          <Stack.Screen name="share-month" options={{ presentation: "modal" }} />
          <Stack.Screen name="capture" options={{ presentation: "modal" }} />
          <Stack.Screen name="review" options={{ presentation: "modal" }} />
          <Stack.Screen name="auto-capture" options={{ presentation: "modal" }} />
        </Stack>
        <AppLockGate />
      </LedgerProvider>
    </SQLiteProvider>
  );
}

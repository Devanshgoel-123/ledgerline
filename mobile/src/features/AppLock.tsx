import * as LocalAuthentication from "expo-local-authentication";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Image, Modal, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { setSetting } from "@/db/repo";
import { useLedger } from "@/state/ledger";
import { Button, T } from "@/ui/components";
import { Icon } from "@/ui/Icon";
import { fonts, space, useTheme } from "@/ui/theme";

/** Back within this long and the app stays open: a quick look at a message or OTP doesn't re-lock it. */
export const LOCK_GRACE_MS = 30_000;

/** What unlocks the phone: Face ID, Touch ID, fingerprint, or only the passcode. */
export async function unlockMethod(): Promise<{ available: boolean; label: string }> {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    if (level === LocalAuthentication.SecurityLevel.NONE) return { available: false, label: "a screen lock" };
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const biometric = level >= LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK;
    if (biometric && types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return { available: true, label: Platform.OS === "ios" ? "Face ID" : "face unlock" };
    }
    if (biometric && types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return { available: true, label: Platform.OS === "ios" ? "Touch ID" : "fingerprint" };
    }
    return { available: true, label: "your phone's passcode" };
  } catch {
    return { available: false, label: "a screen lock" };
  }
}

/** Asks for Face ID, a fingerprint or the phone's passcode. */
export async function confirmOwner(promptMessage: string): Promise<{ ok: boolean; noLock: boolean }> {
  try {
    const result = await LocalAuthentication.authenticateAsync({ promptMessage, cancelLabel: "Cancel" });
    if (result.success) return { ok: true, noLock: false };
    return { ok: false, noLock: result.error === "not_enrolled" || result.error === "passcode_not_set" || result.error === "not_available" };
  } catch {
    return { ok: false, noLock: false };
  }
}

/**
 * Covers the whole app, modals included, until the owner unlocks it: when
 * Ledgerline opens, and when it comes back after more than LOCK_GRACE_MS away.
 */
export function AppLockGate() {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  const { db, ready, appLock, refresh } = useLedger();
  const [unlocked, setUnlocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const awaySince = useRef<number | null>(null);
  const asking = useRef(false);
  const locked = ready && appLock && !unlocked;

  const unlock = useCallback(async () => {
    if (asking.current) return;
    asking.current = true;
    setMessage(null);
    const result = await confirmOwner("Unlock Ledgerline");
    asking.current = false;
    if (result.ok) {
      setUnlocked(true);
      return;
    }
    if (result.noLock) {
      // The phone's own screen lock was removed: there's nothing to unlock
      // with, so app lock turns itself off rather than lock you out.
      await setSetting(db, "appLock", false);
      await refresh();
      setUnlocked(true);
      return;
    }
    setMessage("Not unlocked. Try again.");
  }, [db, refresh]);

  // Lock again after time away. "inactive" alone (a system prompt, the
  // Face ID sheet itself) never locks.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") awaySince.current = Date.now();
      if (state === "active" && awaySince.current !== null) {
        const away = Date.now() - awaySince.current;
        awaySince.current = null;
        if (away > LOCK_GRACE_MS) setUnlocked(false);
      }
    });
    return () => subscription.remove();
  }, []);

  // Ask straight away whenever the lock appears.
  useEffect(() => {
    if (!locked) return;
    const timer = setTimeout(() => void unlock(), 250);
    return () => clearTimeout(timer);
  }, [locked, unlock]);

  return (
    <Modal visible={locked} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => {}} statusBarTranslucent>
      <View style={[s.screen, { backgroundColor: c.bg, paddingTop: insets.top + space[6], paddingBottom: insets.bottom + space[6] }]}>
        <View style={s.middle}>
          <Image source={require("../../assets/images/icon.png")} style={s.icon} accessibilityIgnoresInvertColors />
          <View style={[s.lockBadge, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Icon name="lock" size={16} color={c.foreground} />
          </View>
          <Text style={[s.title, { color: c.foreground }]} accessibilityRole="header">
            Ledgerline is locked
          </Text>
          <T tone="muted" style={{ textAlign: "center" }}>
            Your payments stay hidden until you unlock.
          </T>
          {message ? (
            <T variant="small" tone="danger" style={{ textAlign: "center" }}>
              {message}
            </T>
          ) : null}
        </View>
        <Button label="Unlock" icon="lock" onPress={() => void unlock()} />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: space[5], justifyContent: "space-between" },
  middle: { flex: 1, alignItems: "center", justifyContent: "center", gap: space[3] },
  icon: { width: 88, height: 88, borderRadius: 22 },
  lockBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginTop: -26,
    marginLeft: 70,
  },
  title: { fontFamily: fonts.display, fontSize: 24, marginTop: space[2] },
});

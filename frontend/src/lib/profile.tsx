"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createApiClient } from "@/lib/api/client";
import type { LocalProfile } from "@/lib/api/types";

interface ProfileContextValue {
  profile: LocalProfile | null;
  loading: boolean;
  /** Set when the local API could not be reached. */
  error: string | null;
  retry: () => void;
  saveProfile: (patch: { displayName?: string | null; avatarUrl?: string | null }) => Promise<LocalProfile>;
  /** Erase every transaction, rule and connection on this computer. */
  eraseAllData: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

/** Ledgerline runs for one person on their own computer, so there is no sign-in: load the profile. */
export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void createApiClient()
      .fetchMe()
      .then((me) => {
        if (cancelled) return;
        setProfile(me);
        setError(null);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not reach Ledgerline.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setLoading(true);
    setAttempt((n) => n + 1);
  }, []);

  const saveProfile = useCallback(
    async (patch: { displayName?: string | null; avatarUrl?: string | null }) => {
      const me = await createApiClient().updateProfile(patch);
      setProfile(me);
      return me;
    },
    [],
  );

  const eraseAllData = useCallback(async () => {
    await createApiClient().eraseAllData();
    setProfile(await createApiClient().fetchMe());
  }, []);

  const value = useMemo(
    () => ({ profile, loading, error, retry, saveProfile, eraseAllData }),
    [profile, loading, error, retry, saveProfile, eraseAllData],
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used within ProfileProvider");
  return ctx;
}

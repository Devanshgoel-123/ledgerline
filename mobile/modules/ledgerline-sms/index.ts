import { requireOptionalNativeModule } from "expo";

export interface RawSms {
  sender: string;
  text: string;
  /** Milliseconds since 1970, as the phone stamped it. */
  receivedAt: number;
}

interface LedgerlineSmsModule {
  hasPermission(): boolean;
  readInbox(sinceMillis: number, limit: number): Promise<RawSms[]>;
}

/** The Android SMS reader, or null on iOS, web and Expo Go. */
export const LedgerlineSms = requireOptionalNativeModule<LedgerlineSmsModule>("LedgerlineSms");

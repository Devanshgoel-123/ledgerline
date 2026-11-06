/** What the user chose for reminders. Stored on the phone in settings. */
export interface ReminderSettings {
  /** A daily nudge to add what you spent. */
  daily: boolean;
  /** Times of day for the daily nudge, 24-hour. One or two. */
  times: { hour: number; minute: number }[];
  /** On this day each month, a nudge to check last month's statement. */
  monthlyStatement: boolean;
  monthlyDay: number;
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  daily: false,
  times: [{ hour: 21, minute: 0 }],
  monthlyStatement: false,
  monthlyDay: 5,
};

export const REMINDER_COPY = {
  daily: {
    title: "Spent anything today?",
    body: "Add it now while you remember. It takes a few seconds.",
  },
  monthly: {
    title: "Last month's statement is out",
    body: "Check it against what you added. Ledgerline lists anything that's missing.",
  },
};

/** Where tapping a reminder takes you. */
export const REMINDER_ROUTES = {
  daily: "/add",
  monthly: "/statement",
} as const;

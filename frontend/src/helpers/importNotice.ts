/** What to tell the user after a statement upload, and whether to move on to the overview. */
export function importNoticeFor(
  result: { inserted?: number; isDuplicate?: boolean; message?: string },
  fileName: string,
): { text: string; showOverview: boolean } {
  if (result.isDuplicate) {
    return {
      text: result.message ?? "You already imported this statement. Nothing was added twice.",
      showOverview: false,
    };
  }
  const inserted = result.inserted ?? 0;
  if (inserted === 0) {
    return {
      text: "No new transactions in this statement. Everything in it was already in your ledger.",
      showOverview: false,
    };
  }
  return {
    text: `Imported ${inserted} new transaction${inserted === 1 ? "" : "s"} from ${fileName}.`,
    showOverview: true,
  };
}

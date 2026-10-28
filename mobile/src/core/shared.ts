/**
 * The backend code the app runs on the phone. These modules are pure (no
 * database, no network, no Node APIs), so the phone and the web app read a
 * statement, match it, categorise it and total it the same way.
 * Metro and TypeScript resolve "@shared/*" to backend/src.
 */
export { bankAdapters, detectAdapter } from "@shared/adapters/index.js";
export { pageTextFromItems, type PdfTextItem, type StatementLine } from "@shared/parser.js";
export { unrecordedLines, shiftIsoDate } from "@shared/statementMatch/match.js";
export { classifyTransaction } from "@shared/imports/classification.js";
export { counterpartyFromNarration } from "@shared/narration/party.js";
export { buildAnalyticsFromRows } from "@shared/analytics/fromStore.js";
export {
  assertSharesFit,
  friendTotal,
  myShare,
  normalizeFriends,
  roundMoney,
  SplitInputError,
  type FriendShare,
} from "@shared/splits/share.js";
export { buildDemoTransactions } from "@shared/demo/sample.js";
export { CategorySlug } from "@shared/enums/category.js";
export { ClassificationSource } from "@shared/enums/classification.js";
export type {
  CategoryRow,
  ProviderRow,
  TransactionRow,
  UserRuleRow,
} from "@shared/db/types.js";
export type { ParseResult, Summary } from "@shared/types/finance.js";

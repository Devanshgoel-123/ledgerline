import { hdfcAdapter } from "./hdfc.js";
import { iciciAdapter } from "./icici.js";
import type { BankAdapter } from "./types.js";

// ICICI first: its strict check needs ICICI's own column header, while HDFC detection
// also matches the word "hdfc", which ICICI narrations are full of ("@hdfcbank").
export const bankAdapters: BankAdapter[] = [iciciAdapter, hdfcAdapter];

export { detectAdapter, runAdapters } from "./types.js";
export type { BankAdapter, AdapterMatch } from "./types.js";

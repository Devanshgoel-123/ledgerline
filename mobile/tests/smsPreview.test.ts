import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseBankMessage } from "@/core/sms";

/**
 * The iOS "Log bank message" action reads amount and direction in Swift
 * (plugins/native/BankMessagePreview.swift) to notify you straight away; the
 * app reads the same message with src/core/sms.ts when it adds the entry.
 * This runs the Swift reader on every message in tests/sms.test.ts and checks
 * both agree. It needs a Mac with Swift, so it's opt-in:
 *
 *   CHECK_SWIFT=1 npx vitest run tests/smsPreview.test.ts
 */
const run = process.env.CHECK_SWIFT === "1" ? describe : describe.skip;

function testMessages(): { text: string; sender: string | null }[] {
  // Every message-like string in the parser's tests: payments, ignored
  // messages and amount cases alike, with the sender when one is given.
  const source = readFileSync(join(__dirname, "sms.test.ts"), "utf8");
  const found: { text: string; sender: string | null }[] = [];
  for (const match of source.matchAll(/"((?:[^"\\\n]|\\.){30,})"/g)) {
    const text = JSON.parse(`"${match[1]!}"`) as string;
    if (!/\d/.test(text)) continue;
    const after = source.slice(match.index! + match[0].length, match.index! + match[0].length + 80);
    found.push({ text, sender: after.match(/^[^)]*?sender:\s*"([^"]+)"/)?.[1] ?? null });
  }
  return found;
}

run("Swift bank message preview", () => {
  it("agrees with the app's parser on amount, direction and bank", () => {
    const messages = testMessages();
    expect(messages.length).toBeGreaterThan(20);
    const dir = mkdtempSync(join(tmpdir(), "ledgerline-swift-"));
    const binary = join(dir, "preview");
    const native = join(__dirname, "..", "plugins", "native", "BankMessagePreview.swift");
    const compiled = spawnSync("swiftc", ["-O", "-o", binary, native, join(__dirname, "swift", "main.swift")], { encoding: "utf8" });
    expect(compiled.stderr).toBe("");
    const ran = spawnSync(binary, { input: JSON.stringify(messages), encoding: "utf8" });
    const swift = JSON.parse(ran.stdout) as ({ amount: number; isCredit: boolean; bank?: string | null } | null)[];

    messages.forEach((message, index) => {
      const ts = parseBankMessage(message.text, { sender: message.sender, receivedOn: "2026-11-05" });
      const expected = ts ? { amount: ts.amount, isCredit: ts.type === "credit", bank: ts.bank } : null;
      const got = swift[index] ? { ...swift[index]!, bank: swift[index]!.bank ?? null } : null;
      expect(got, message.text).toEqual(expected);
    });
  }, 120_000);

  it("opens the popup only for money that moved: debits, credits, autopays", () => {
    const dir = mkdtempSync(join(tmpdir(), "ledgerline-swift-"));
    const binary = join(dir, "loose");
    const native = join(__dirname, "..", "plugins", "native", "BankMessagePreview.swift");
    expect(spawnSync("swiftc", ["-o", binary, native, join(__dirname, "swift", "main.swift")], { encoding: "utf8" }).stderr).toBe("");
    const cases: [string, boolean, boolean][] = [
      ["Your a/c XX1234 is debited for a txn at DMART on 05-11. -Some Bank", true, false],
      ["AutoPay for Netflix processed from your HDFC Bank account on 05-11. Info: NFLX", true, false],
      ["Your account XX1234 has been credited by a deposit on 05-11. -Some Bank", true, true],
      ["Avl bal in A/c XX1234 is Rs 10,000.00 as on 05-11. -Some Bank", false, false],
      ["Get Rs 500 off on your next UPI payment! Use code SAVE500. T&C apply", false, false],
      ["Your AutoPay of Rs 199 for Netflix has been set up successfully", false, false],
      ["Your OTP for the transaction of Rs 5,000 is 482913. Do not share it", false, false],
      ["Hey, are we still on for dinner tonight at 8?", false, false],
    ];
    const ran = spawnSync(binary, { input: JSON.stringify(cases.map(([text]) => ({ text, sender: null }))), encoding: "utf8", env: { ...process.env, LOOSE: "1" } });
    const got = JSON.parse(ran.stdout) as { mightBePayment: boolean; soundsLikeCredit: boolean }[];
    cases.forEach(([text, payment, credit], index) => {
      expect(got[index]!.mightBePayment, text).toBe(payment);
      if (payment) expect(got[index]!.soundsLikeCredit, text).toBe(credit);
    });
  }, 120_000);
});

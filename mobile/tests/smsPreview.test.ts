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
});

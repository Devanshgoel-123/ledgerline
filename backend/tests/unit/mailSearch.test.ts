import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BANK_MAIL_VENDORS, catalogSendersForBank } from "../../src/constants/index.js";
import {
  fromAddressMatchesSenders,
  normalizeMailSender,
  normalizeMailSenders,
  sendersForBank,
} from "../../src/helpers/mailSenders.js";
import {
  describeLoginError,
  filterMailRefs,
  imapSearchCriteria,
  messageIdFor,
} from "../../src/bankMail/mailbox.js";
import { mailServerFor } from "../../src/bankMail/providers.js";

const HDFC = catalogSendersForBank("HDFC");

describe("bank sender normalization", () => {
  it("expands truncated HDFC alert handles and drops invalid ones", () => {
    assert.equal(normalizeMailSender("  "), null);
    assert.equal(normalizeMailSender("()"), null);
    assert.equal(normalizeMailSender("not-a-sender"), null);
    assert.equal(normalizeMailSender("user@nodot"), null);
    assert.equal(normalizeMailSender(" Alerts@HDFCBANK "), "alerts@hdfcbank.net");
    assert.equal(normalizeMailSender("(hdfcbank.net)"), "hdfcbank.net");
    assert.equal(
      normalizeMailSender("alerts@hdfcbank.bank.in"),
      "alerts@hdfcbank.bank.in",
    );
    assert.deepEqual(
      normalizeMailSenders([
        "hdfcbank.net",
        "alerts@hdfcbank",
        "not-a-sender",
        "HDFCBANK.NET",
      ]),
      ["hdfcbank.net", "alerts@hdfcbank.net"],
    );
  });

  it("matches a From header against the bank's senders", () => {
    assert.equal(
      fromAddressMatchesSenders(
        "HDFC Bank InstaAlerts <alerts@hdfcbank.bank.in>",
        ["hdfcbank.bank.in"],
      ),
      true,
    );
    assert.equal(
      fromAddressMatchesSenders("Groww Digest <noreply@digest.groww.in>", [
        "hdfcbank.bank.in",
      ]),
      false,
    );
    assert.equal(
      fromAddressMatchesSenders("alerts@HDFCBANK.NET", ["hdfcbank.net"]),
      true,
    );
    assert.equal(fromAddressMatchesSenders("alerts@hdfcbank.bank.in", []), false);
    assert.equal(fromAddressMatchesSenders("x@mail.hdfcbank.net", ["hdfcbank.net"]), true);
    assert.equal(fromAddressMatchesSenders("x@nothdfcbank.net", ["hdfcbank.net"]), false);
    assert.equal(fromAddressMatchesSenders("x@hdfcbank.net.evil.example", ["hdfcbank.net"]), false);
    assert.equal(
      fromAddressMatchesSenders('"alerts@hdfcbank.net" <x@evil.example>', ["hdfcbank.net"]),
      false,
    );
    assert.equal(fromAddressMatchesSenders("other@hdfcbank.net", ["alerts@hdfcbank.net"]), false);
    assert.equal(
      fromAddressMatchesSenders("alerts@hdfcbank.bank.in", ["not-a-sender"]),
      false,
    );
  });
});

describe("bank mail catalog", () => {
  it("returns each bank's senders and nothing for an unknown bank", () => {
    assert.deepEqual(catalogSendersForBank(" hdfc "), [
      "hdfcbank.bank.in",
      "hdfcbank.net",
      "hdfcbank.com",
    ]);
    assert.deepEqual(catalogSendersForBank("sbi"), ["sbi.co.in", "onlinesbi.com"]);
    assert.deepEqual(catalogSendersForBank("ICICI"), ["icicibank.com"]);
    assert.deepEqual(catalogSendersForBank("axis"), ["axisbank.com"]);
    assert.deepEqual(catalogSendersForBank("unknown"), []);
  });
});

describe("bank mail vendors", () => {
  it("includes the confirmed HDFC InstaAlerts domain and keeps legacy domains", () => {
    const hdfc = BANK_MAIL_VENDORS.filter((vendor) => vendor.bankId === "HDFC");
    assert.deepEqual(
      hdfc.map((vendor) => vendor.sender),
      ["hdfcbank.bank.in", "hdfcbank.net", "hdfcbank.com"],
    );
    assert.equal(
      hdfc.find((vendor) => vendor.sender === "hdfcbank.bank.in")?.exampleFrom,
      "alerts@hdfcbank.bank.in",
    );
    assert.equal(hdfc.filter((vendor) => vendor.confirmed).length, 1);
  });

  it("unions catalog senders with addresses already saved on the account", () => {
    assert.deepEqual(sendersForBank("HDFC", ["alerts@hdfcbank.net", "hdfcbank.bank.in"]), [
      "hdfcbank.bank.in",
      "hdfcbank.net",
      "hdfcbank.com",
      "alerts@hdfcbank.net",
    ]);
    assert.deepEqual(sendersForBank("unknown", ["custom.bank.in"]), ["custom.bank.in"]);
    assert.deepEqual(sendersForBank("unknown"), []);
    assert.deepEqual(sendersForBank("sbi"), catalogSendersForBank("SBI"));
  });
});

describe("IMAP search", () => {
  it("asks for mail from any bank sender, a day wider than the IST window", () => {
    const criteria = imapSearchCriteria({ senders: HDFC, after: "2026-07-27", before: "2026-08-01", kind: "alert" });
    assert.deepEqual(criteria.or, [
      { from: "hdfcbank.bank.in" },
      { from: "hdfcbank.net" },
      { from: "hdfcbank.com" },
    ]);
    assert.equal((criteria.since as Date).toISOString().slice(0, 10), "2026-07-26");
    assert.equal((criteria.before as Date).toISOString().slice(0, 10), "2026-08-02");
    assert.equal(criteria.subject, undefined);
  });

  it("puts a single sender in FROM and asks statements for the word in the subject", () => {
    const criteria = imapSearchCriteria({ senders: ["hdfcbank.bank.in"], after: "2026-07-01", kind: "statement" });
    assert.equal(criteria.from, "hdfcbank.bank.in");
    assert.equal(criteria.or, undefined);
    assert.equal(criteria.before, undefined);
    assert.equal(criteria.subject, "statement");
  });

  it("refuses to search without a valid sender, so it never reads the whole mailbox", () => {
    assert.throws(
      () => imapSearchCriteria({ senders: ["not-a-sender"], kind: "alert" }),
      /No valid bank sender emails configured/,
    );
  });

  it("keeps only the bank's mail inside the IST window, newest first", () => {
    const refs = filterMailRefs(
      [
        { id: "a", subject: "UPI txn", fromAddress: "alerts@hdfcbank.bank.in", receivedAt: "2026-07-26T20:00:00Z" },
        { id: "b", subject: "UPI txn", fromAddress: "HDFC <alerts@hdfcbank.bank.in>", receivedAt: "2026-07-28T05:00:00Z" },
        { id: "c", subject: "Offer", fromAddress: "deals@hdfcbank.bank.in.example.com", receivedAt: "2026-07-29T05:00:00Z" },
        { id: "d", subject: "Newsletter", fromAddress: "news@groww.in", receivedAt: "2026-07-29T05:00:00Z" },
        { id: "e", subject: "UPI txn", fromAddress: "alerts@hdfcbank.bank.in", receivedAt: "2026-08-01T00:00:00+05:30" },
        { id: "f", subject: "UPI txn", fromAddress: "alerts@hdfcbank.bank.in", receivedAt: null },
      ],
      { senders: ["hdfcbank.bank.in"], after: "2026-07-27", before: "2026-08-01", kind: "alert" },
    );
    // 20:00 UTC on the 26th is the 27th in IST, so "a" is inside; "e" is the exclusive end.
    // "c" only looks like the bank: its domain is example.com.
    assert.deepEqual(refs.map((ref) => ref.id), ["b", "a"]);
  });
});

describe("mail message ids", () => {
  it("uses the Message-ID header, and the mailbox UID when there is none", () => {
    assert.equal(messageIdFor({ messageId: "<abc@hdfcbank.net>", uidValidity: 7n, uid: 9 }), "abc@hdfcbank.net");
    assert.equal(messageIdFor({ messageId: "", uidValidity: 7n, uid: 9 }), "uid:7:9");
    assert.equal(messageIdFor({ messageId: `<${"x".repeat(500)}>`, uidValidity: 7n, uid: 9 }), "uid:7:9");
  });
});

describe("mail providers", () => {
  it("knows the preset servers and needs a host for a custom one", () => {
    assert.deepEqual(mailServerFor("gmail"), { id: "gmail", label: "Gmail", host: "imap.gmail.com", port: 993 });
    assert.equal(mailServerFor("custom"), null);
    assert.deepEqual(mailServerFor("custom", { host: " IMAP.Example.com ", port: 143 }), {
      host: "imap.example.com",
      port: 143,
    });
  });
});

describe("mail login errors", () => {
  it("says what to fix in plain words", () => {
    assert.match(describeLoginError({ authenticationFailed: true }, "imap.gmail.com"), /not accepted/);
    assert.match(
      describeLoginError({ responseText: "[ALERT] Application-specific password required" }, "imap.gmail.com"),
      /app password/,
    );
    assert.match(describeLoginError({ responseText: "IMAP access is disabled for your domain" }, "x"), /IMAP turned off/);
    assert.match(describeLoginError({ code: "ENOTFOUND" }, "imap.nope.test"), /Could not find the mail server imap\.nope\.test/);
    assert.match(describeLoginError({ code: "ETIMEDOUT" }, "imap.example.com"), /Could not reach/);
    assert.match(describeLoginError(new Error("boom"), "x"), /Could not sign in/);
  });
});

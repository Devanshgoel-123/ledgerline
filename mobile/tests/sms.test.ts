import { describe, expect, it } from "vitest";
import { messageDate, parseBankMessage } from "@/core/sms";

// Modelled on the common Indian bank SMS formats. Replace or extend with real,
// anonymised messages from testers; each bank changes wording over time.
const ON = { receivedOn: "2026-11-05" };

describe("bank SMS: payments out", () => {
  it("HDFC UPI 'Sent'", () => {
    const p = parseBankMessage(
      "Sent Rs.250.00\nFrom HDFC Bank A/C *1234\nTo SWIGGY\nOn 05/11/26\nRef 532912345678\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808",
      { ...ON, sender: "AD-HDFCBK" },
    );
    expect(p).toMatchObject({ amount: 250, type: "debit", date: "2026-11-05", party: "SWIGGY", reference: "532912345678", account: "1234", method: "upi", bank: "HDFC" });
  });

  it("ICICI account debited, merchant credited", () => {
    const p = parseBankMessage(
      "ICICI Bank Acct XX123 debited for Rs 450.00 on 04-Nov-26; Zomato credited. UPI:532912345680. Call 18002662 for dispute. SMS BLOCK 123 to 9215676766.",
      ON,
    );
    expect(p).toMatchObject({ amount: 450, type: "debit", date: "2026-11-04", party: "Zomato", reference: "532912345680", account: "123", bank: "ICICI" });
  });

  it("SBI 'debited by' with no currency", () => {
    const p = parseBankMessage(
      "Dear UPI user A/C X1234 debited by 120.0 on date 05Nov26 trf to RAPIDO Refno 532912345681. If not u? call 1800111109. -SBI",
      ON,
    );
    expect(p).toMatchObject({ amount: 120, type: "debit", date: "2026-11-05", party: "RAPIDO", reference: "532912345681", bank: "SBI" });
  });

  it("Axis UPI/P2M", () => {
    const p = parseBankMessage(
      "INR 899.00 debited\nA/c no. XX1234\n05-11-26, 13:45:10\nUPI/P2M/532912345682/MYNTRA\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank",
      ON,
    );
    expect(p).toMatchObject({ amount: 899, type: "debit", date: "2026-11-05", party: "MYNTRA", reference: "532912345682", bank: "Axis" });
  });

  it("Kotak sent to a UPI id", () => {
    const p = parseBankMessage(
      "Sent Rs.60.00 from Kotak Bank AC X1234 to chaiwala@ybl on 05-11-26.UPI Ref 532912345683. Not you, https://kotak.com/KBANKT/Fraud",
      ON,
    );
    expect(p).toMatchObject({ amount: 60, type: "debit", upiId: "chaiwala@ybl", party: null, reference: "532912345683", bank: "Kotak" });
  });

  it("credit card spend, with thousands separator", () => {
    const p = parseBankMessage(
      "Spent Rs.1,240 On HDFC Bank Card 1234 At BLINKIT On 2026-11-05:18:22:10.Not You? To Block+Reissue Call 18002586161",
      ON,
    );
    expect(p).toMatchObject({ amount: 1240, type: "debit", date: "2026-11-05", party: "BLINKIT", method: "card", account: "1234" });
  });
});

describe("bank SMS: money in", () => {
  it("HDFC credit from a VPA", () => {
    const p = parseBankMessage(
      "Credit Alert!\nRs.5000.00 credited to HDFC Bank A/c XX1234 on 05-11-26 from VPA kabir@okicici (UPI 532912345679)",
      ON,
    );
    expect(p).toMatchObject({ amount: 5000, type: "credit", upiId: "kabir@okicici", reference: "532912345679" });
  });

  it("salary NEFT credit", () => {
    const p = parseBankMessage("Your A/c XX1234 is credited with INR 65,000.00 on 01-11-26 by NEFT from ACME PVT LTD. Avl Bal INR 82,340.12", ON);
    expect(p).toMatchObject({ amount: 65000, type: "credit", date: "2026-11-01", party: "ACME PVT LTD" });
  });

  it("refund is money in, even though it mentions a purchase", () => {
    const p = parseBankMessage("Refund of Rs 499.00 for your purchase at AMAZON has been credited to your A/c XX1234 on 05-11-26", ON);
    expect(p).toMatchObject({ amount: 499, type: "credit" });
  });
});

describe("bank SMS: ignored", () => {
  const ignored = {
    otp: "123456 is your OTP for txn of Rs 500.00 at AMAZON on HDFC Bank card ending 1234. Valid till 10:12. Do not share OTP",
    collect: "Rs 500.00 has been requested by kabir@okicici via UPI. Approve with your UPI PIN only if you know the requester.",
    failed: "Your UPI transaction of Rs 250.00 to SWIGGY has failed. Amount if debited will be reversed in 3 days.",
    due: "Payment of Rs 12,430 on your HDFC Bank Credit Card ending 1234 is due on 15-11-26. Minimum due Rs 620.",
    offer: "Get a pre-approved loan of Rs 5,00,000 at 10.5%. Apply now: https://hdfc.bank/x T&C apply",
    balance: "Your A/c XX1234 balance is Rs 23,450.20 as on 05-11-26.",
    future: "Rs 649.00 will be debited from your A/c XX1234 on 07-11-26 for NETFLIX autopay.",
    chat: "hey can you send me 200 for the cab",
  };
  for (const [name, text] of Object.entries(ignored)) {
    it(name, () => expect(parseBankMessage(text, ON)).toBeNull());
  }
});

describe("dates", () => {
  it("ignores dates far from when the message arrived", () => {
    expect(messageDate("Valid till 01/01/30, sent on 05/11/26", "2026-11-05")).toBe("2026-11-05");
  });
  it("falls back to the day received", () => {
    const p = parseBankMessage("Rs 75 debited from A/c XX1234 to tea stall", ON);
    expect(p?.date).toBe("2026-11-05");
  });
});

describe("amounts", () => {
  const amount = (text: string) => parseBankMessage(text, ON)?.amount;
  it("reads whole numbers without stopping early", () => {
    expect(amount("Rs.5000.00 debited from A/c XX1234 to SWIGGY")).toBe(5000);
    expect(amount("INR 12345 debited from A/c XX1234 to SWIGGY")).toBe(12345);
  });
  it("reads Indian and international grouping", () => {
    expect(amount("Rs 1,00,000.50 debited from A/c XX1234 to LANDLORD")).toBe(100000.5);
    expect(amount("Rs 100,000 debited from A/c XX1234 to LANDLORD")).toBe(100000);
  });
});

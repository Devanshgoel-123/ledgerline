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

describe("which bank, and who paid", () => {
  it("names your bank, not the payee's bank in their UPI id", () => {
    const p = parseBankMessage(
      "Sent Rs.649.00 from Kotak Bank AC X1234 to netflix@hdfcbank on 08-11-26.UPI Ref 630777777777. Not you, https://kotak.com/KBANKT/Fraud",
      ON,
    );
    expect(p?.bank).toBe("Kotak");
    expect(p?.upiId).toBe("netflix@hdfcbank");
  });

  it("prefers the Android sender ID when there is one", () => {
    const p = parseBankMessage("Rs.250.00 debited from a/c **1234 on 07-11-26 to VPA shop@okhdfcbank (UPI Ref No 630799999999)", {
      ...ON,
      sender: "VM-AXISBK-S",
    });
    expect(p?.bank).toBe("Axis");
  });

  it("doesn't take the amount for the payer", () => {
    const p = parseBankMessage(
      "Your A/c XXXXX1234 is credited by Rs.65,000.00 on 03-11-2026 by NEFT ACME CORP. Avl Bal Rs.75,048.00 -Yes Bank",
      ON,
    );
    expect(p?.type).toBe("credit");
    expect(p?.party).toBe("ACME CORP");
  });
});

// More banks. Wording from the templates these banks send (as collected by
// open-source SMS parsers), with made-up names, accounts and references.
// [message, amount, type, bank, party or undefined to skip]
const MORE_BANKS: [string, number, "debit" | "credit", string | null, string | null | undefined][] = [
  // HDFC and Axis, from a tester's phone
  ["Sent Rs.180.00\nFrom HDFC Bank A/C *2641\nTo MD SAMEER\nOn 09/11/26\nRef 132617110699\nNot You?\nCall 18002586161/SMS BLOCK UPI to 7308080808", 180, "debit", "HDFC", "MD SAMEER"],
  ["INR 5.00 debited\nA/c no. XX0483\n07-11-26, 17:30:57\nUPI/P2A/667790166602/DEVANSH GOEL\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank", 5, "debit", "Axis", "DEVANSH GOEL"],
  ["INR 2,500.00 credited\nA/c no. XX0483\n05-11-26, 10:12:01\nUPI/P2A/532912345690/RAHUL SHARMA\nNot you? SMS BLOCKUPI Cust ID to 919951860002\nAxis Bank", 2500, "credit", "Axis", "RAHUL SHARMA"],
  ["Spent Rs.1,250 On HDFC Bank Card 1234 At AMAZON On 2026-11-05:18:30:00 Not You? To Block+Reissue Call 18002586161/SMS BLOCK CC 1234 to 7308080808", 1250, "debit", "HDFC", "AMAZON"],
  ["Credit Alert!\nRs.500.00 credited to HDFC Bank A/c XX2641 on 05-11-26 from VPA rahul@okaxis (UPI 532912345691)", 500, "credit", "HDFC", undefined],
  // SBI
  ["Dear SBI UPI User, ur A/cX1234 credited by Rs500 on 05Nov26 by (Ref no 532912345692)", 500, "credit", "SBI", undefined],
  ["Rs.1,499.00 spent on your SBI Credit Card ending 1234 at FLIPKART on 05/11/26. Trxn. not done by you? Report at https://sbicard.com/Dispute", 1499, "debit", "SBI", "FLIPKART"],
  // ICICI
  ["Dear Customer, Acct XX123 is credited with Rs 750.00 on 05-Nov-26 from RAHUL. UPI:532912345693-ICICI Bank.", 750, "credit", "ICICI", "RAHUL"],
  ["INR 2,999.00 spent using ICICI Bank Card XX1234 on 05-Nov-26 on MYNTRA. Avl Limit: INR 50,000.00. If not you, call 1800 2662/SMS BLOCK 1234 to 9215676766.", 2999, "debit", "ICICI", undefined],
  // Kotak
  ["Sent Rs.320.00 from Kotak Bank AC X1234 to swiggy@icici on 05-11-26.UPI Ref 532912345694. Not you, https://kotak.com/KBANKT/Fraud", 320, "debit", "Kotak", undefined],
  ["Received Rs.1,000.00 in your Kotak Bank AC X1234 from rahul@okaxis on 05-11-26.UPI Ref:532912345695.", 1000, "credit", "Kotak", undefined],
  // PNB: the debit also says "credited to A/c of" the payee
  ["Your A/c XX1234 has been debited for Rs.250.00 on 05-11-2026 18:30:00 and credited to A/c of SWIGGY (UPI Ref No 532912345696). If not done by you, call 18001802222 - PNB", 250, "debit", "PNB", undefined],
  // Bank of Baroda: "transferred", and a balance marked CR
  ["Rs.400.00 transferred from A/c ...1234 to:UPI/532912345697. Total Bal:Rs.10000.00CR. Avlbl Amt:Rs.10000.00(05-11-2026 18:30:00) - Bank of Baroda", 400, "debit", "Bank of Baroda", undefined],
  ["Rs.600 Credited to A/c ...1234 thru UPI/532912345698 by rahul@okaxis. Total Bal:Rs.10600.00CR. Avlbl Amt:Rs.10600.00(05-11-2026) - Bank of Baroda", 600, "credit", "Bank of Baroda", undefined],
  // Union Bank: "Rs:" with a colon
  ["A/c *1234 Debited for Rs:350.00 on 05-11-2026 18:30:00 by Mob Bk ref no 532912345699 Avl Bal Rs:10000.00.If not you, Call 1800222243 -Union Bank of India", 350, "debit", "Union Bank", undefined],
  // Canara
  ["Rs.220.00 paid thru A/C XX1234 on 05-11-26 18:30:00 to SWIGGY, UPI Ref 532912345700. If not done, SMS BLOCKUPI to 9901771222.-Canara Bank", 220, "debit", "Canara", "SWIGGY"],
  ["An amount of INR 1,200.00 has been CREDITED to your account XXX1234 on 05/11/2026 towards UPI/532912345701. Total Avail.bal INR 11,200.00. - Canara Bank", 1200, "credit", "Canara", undefined],
  // Bank of India: the debit also says "credited to" the payee
  ["Rs.180.00 debited A/cXX1234 and credited to ZEPTO via UPI Ref No 532912345702 on 05Nov26. Call 18001031906, if not done by you. -BOI", 180, "debit", "Bank of India", undefined],
  // IDFC First, IndusInd, Yes, Federal, AU, Indian Bank
  ["Your A/C XXXXX1234 is debited by INR 650.00 on 05/11/26 18:30. New Bal :INR 10,000.00. UPI Ref 532912345703 - IDFC FIRST Bank", 650, "debit", "IDFC First", undefined],
  ["Your A/c 1234XXXX1234 is debited for INR 275.00 towards UPI/532912345704/SWIGGY. Avl Bal INR 10,000.00 - IndusInd Bank", 275, "debit", "IndusInd", undefined],
  ["INR 99.00 debited from A/c XX1234 on 05-11-2026 towards UPI/532912345705/SPOTIFY. Avl Bal: INR 10,000.00 - YES BANK", 99, "debit", "Yes Bank", undefined],
  ["Rs 430.00 debited from your A/c using UPI on 05-11-2026 18:30:00 to VPA blinkit@hdfcbank - (UPI Ref No 532912345706)-Federal Bank", 430, "debit", "Federal", undefined],
  ["Debited INR 199.00 from A/c XX1234 on 05-11-2026 UPI/DR/532912345707/NETFLIX. Bal INR 10,000.00 - AU Small Finance Bank", 199, "debit", "AU", undefined],
  ["Your A/c XX1234 is debited Rs. 560.00 on 05-11-26 to VPA zomato@icici. UPI Ref 532912345708 -Indian Bank", 560, "debit", "Indian Bank", undefined],
  // Autopay and NACH that went through
  ["Rs.149.00 debited from A/c XX1234 on 05-11-26 for AutoPay of NETFLIX via UPI Mandate. UPI Ref 532912345709 - HDFC Bank", 149, "debit", "HDFC", undefined],
  ["Your A/c XX1234 is debited for Rs.5,000.00 on 05-11-26 towards NACH-DR- SIP GROWW. Avl Bal Rs.20,000.00 -ICICI Bank", 5000, "debit", "ICICI", undefined],
  // Paytm Payments Bank, Amex
  ["Paid Rs.85 to CHAI POINT from Paytm Payments Bank a/c 91XX1234. UPI Ref: 532912345710", 85, "debit", "Paytm Payments Bank", "CHAI POINT"],
  ["Alert: You've spent INR 3,400.00 on your AMEX card ** 12345 at CROMA on 05 November 2026 at 06:30 PM IST.", 3400, "debit", "Amex", "CROMA"],
];

describe("bank SMS: more Indian banks", () => {
  it.each(MORE_BANKS)("%s", (text, amount, type, bank, party) => {
    const p = parseBankMessage(text, { ...ON, sender: null });
    expect(p).toMatchObject({ amount, type, bank });
    if (party !== undefined) expect(p?.party).toBe(party);
  });
});

describe("the banks the capture screen lists", () => {
  it("names every bank the reader knows, once", async () => {
    const { SUPPORTED_BANKS } = await import("@/core/sms");
    expect(SUPPORTED_BANKS.length).toBeGreaterThanOrEqual(20);
    expect(new Set(SUPPORTED_BANKS).size).toBe(SUPPORTED_BANKS.length);
    expect(SUPPORTED_BANKS).toEqual(expect.arrayContaining(["HDFC", "SBI", "ICICI", "Axis", "Kotak", "Bank of India"]));
  });
});

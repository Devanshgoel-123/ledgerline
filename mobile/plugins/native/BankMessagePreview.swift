import Foundation

// Just enough of a bank SMS to tell you about it right away: the amount,
// whether money went out or came in, and the bank. The full reading (who was
// paid, the date, the reference, the category, duplicates) is done by the app
// with src/core/sms.ts when it adds the entry; this mirrors that file's rules
// for amount, direction and what isn't a payment, so the two agree.
//
// Foundation only, so it can be checked on a Mac with `swift` (see
// tests/smsPreview.test.ts, CHECK_SWIFT=1). Copied into the iOS project by
// plugins/withBankMessageIntent.js.

struct BankMessagePreview: Equatable {
  let amount: Double
  let isCredit: Bool
  let bank: String?

  private static func regex(_ pattern: String) -> NSRegularExpression {
    // The patterns are fixed and tested; a typo should fail loudly in development.
    try! NSRegularExpression(pattern: pattern, options: [.caseInsensitive])
  }

  private static let notAPayment: [NSRegularExpression] = [
    #"\botp\b|one[\s-]time password|verification code|\bcode is\b"#,
    #"\b(has )?requested\b|\bcollect request\b|\brequest(ing)? (money|payment)\b|\bapprove\b.*\bupi pin\b"#,
    #"\b(failed|declined|unsuccessful|could not be processed|not processed)\b"#,
    #"\b(is|are) due\b|\bdue (date|on|by)\b|\bminimum (amount )?due\b|\bstatement (is )?generated\b|\bbill (of|for) .* (is )?due\b"#,
    #"\bpre-?approved\b|\bapply now\b|\bloan (of|upto|up to)\b|\boffer\b.*\b(t&c|click|apply)\b"#,
    #"\bwill be (debited|deducted)\b|\bscheduled\b|\bmandate\b.*\b(created|registered)\b|\bauto-?pay\b.*\b(set|registered)\b"#,
  ].map(regex)

  private static let number = #"(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?(?![\d,])|\d+(?:\.\d{1,2})?(?!\d))"#
  private static let amountWithCurrency = regex(#"(?:rs\.?|inr|₹)\s*"# + number)
  private static let amountAfterVerb = regex(#"\b(?:debited|credited|spent|paid|sent)\s+(?:by|with|for|of)?\s*"# + number + #"\b"#)

  private static let creditToAccount: [NSRegularExpression] = [
    #"\bcredited\s+(?:to|in|into)\b[^.;]{0,40}\b(?:a\/c|acct|account|ac)\b"#,
    #"\b(?:a\/c|acct|account|ac)\b(?:\s*no\.?)?\s*[x*]*\d{2,6}\s+(?:is\s+|has been\s+)?credited\b"#,
    #"\b(?:you have )?received\b|\brefund(?:ed)?\b|\breversed\b|\bdeposited\b"#,
  ].map(regex)
  private static let debitWords = regex(#"\b(debited|spent|sent|paid|withdrawn|purchase|debit of|txn of)\b"#)
  private static let creditedWord = regex(#"\bcredited\b"#)
  private static let upiId = regex(#"\S+@\S+"#)

  private static let banks: [(NSRegularExpression, String)] = [
    (#"hdfc"#, "HDFC"),
    (#"icici"#, "ICICI"),
    (#"\bsbi\b|sbiinb|sbipsg|state bank"#, "SBI"),
    (#"axis"#, "Axis"),
    (#"kotak|kotakb"#, "Kotak"),
    (#"\bpnb\b|punjab national"#, "PNB"),
    (#"bank of baroda|\bbob\b"#, "Bank of Baroda"),
    (#"idfc"#, "IDFC First"),
    (#"yes ?bank"#, "Yes Bank"),
    (#"indusind"#, "IndusInd"),
    (#"\bau (small finance )?bank|aubank"#, "AU"),
    (#"federal"#, "Federal"),
    (#"canara"#, "Canara"),
    (#"union bank"#, "Union Bank"),
  ].map { (regex($0.0), $0.1) }

  private static func matches(_ pattern: NSRegularExpression, _ text: String) -> Bool {
    pattern.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)) != nil
  }

  private static func firstGroup(_ pattern: NSRegularExpression, _ text: String) -> String? {
    guard let match = pattern.firstMatch(in: text, range: NSRange(text.startIndex..., in: text)),
          let range = Range(match.range(at: 1), in: text) else { return nil }
    return String(text[range])
  }

  /// A payment in the message, or nil for anything else (OTPs, requests, offers, dues, failures).
  static func parse(_ raw: String, sender: String?) -> BankMessagePreview? {
    let text = raw.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ")
    guard text.count >= 15, text.count <= 800 else { return nil }
    if notAPayment.contains(where: { matches($0, text) }) { return nil }

    guard let rawAmount = firstGroup(amountWithCurrency, text) ?? firstGroup(amountAfterVerb, text),
          let value = Double(rawAmount.replacingOccurrences(of: ",", with: "")),
          value > 0 else { return nil }

    let isCredit: Bool
    if creditToAccount.contains(where: { matches($0, text) }) {
      isCredit = true
    } else if matches(debitWords, text) {
      isCredit = false
    } else if matches(creditedWord, text) {
      isCredit = true
    } else {
      return nil
    }

    return BankMessagePreview(amount: (value * 100).rounded() / 100, isCredit: isCredit, bank: bank(text, sender: sender))
  }

  private static let moneyWords = regex(#"(?:rs\.?|inr|₹)\s*\d|\b(?:debited|credited|a\/c|acct|upi|neft|imps|spent|withdrawn)\b"#)

  /// A message parse() couldn't read but that still talks about money from a
  /// bank (not an OTP, offer or due date), so the popup asks for the amount
  /// rather than dropping it. Chats and everything else stay silent.
  static func mightBePayment(_ raw: String) -> Bool {
    let text = raw.components(separatedBy: .whitespacesAndNewlines).filter { !$0.isEmpty }.joined(separator: " ")
    guard text.count >= 15, text.count <= 800 else { return false }
    if notAPayment.contains(where: { matches($0, text) }) { return false }
    return matches(moneyWords, text)
  }

  private static func bank(_ text: String, sender: String?) -> String? {
    // The sender ID names the bank best ("AD-KOTAKB"). In the text, a UPI id
    // like netflix@hdfcbank names the payee's bank, not yours.
    if let sender, let hit = banks.first(where: { matches($0.0, sender) }) { return hit.1 }
    let own = upiId.stringByReplacingMatches(in: text, range: NSRange(text.startIndex..., in: text), withTemplate: " ")
    return banks.first(where: { matches($0.0, own) })?.1
  }

  /// "₹1,24,860" or "₹249.50", the way the app writes amounts.
  var formattedAmount: String { Self.format(amount) }

  static func format(_ amount: Double) -> String {
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: "en_IN")
    formatter.numberStyle = .decimal
    formatter.minimumFractionDigits = amount.truncatingRemainder(dividingBy: 1) == 0 ? 0 : 2
    formatter.maximumFractionDigits = 2
    return "₹" + (formatter.string(from: NSNumber(value: amount)) ?? String(amount))
  }
}

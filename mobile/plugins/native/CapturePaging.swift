import Foundation

// Two small rules for the payment popup, Foundation only so they can be
// checked on a Mac with `swift` (tests/capturePopup.test.ts, CHECK_SWIFT=1).
// Copied into the iOS project by plugins/withBankMessageIntent.js.

/// The popup shows a few categories at a time. The iOS popup doesn't scroll
/// well, so a long list is paged: your five most used, then "More categories"
/// for the next six, and so on. A page never ends with just one left over.
enum CapturePaging {
  static let firstPage = 5
  static let pageSize = 6

  /// The slice of the list to show from `start`, and whether more follow.
  static func page(count: Int, start: Int) -> (range: Range<Int>, hasMore: Bool) {
    let from = max(0, min(start, count))
    var end = min(count, from + (from == 0 ? firstPage : pageSize))
    if count - end == 1 { end = count }
    return (from..<end, end < count)
  }
}

/// Payments the popup asked about in the last few minutes. A bank often
/// sends two or three messages for one payment (the debit alert, the UPI
/// confirmation, the card's own SMS); after the first, the others are logged
/// quietly instead of opening a popup over the one you're answering.
struct RecentPayments: Codable, Equatable {
  struct Payment: Codable, Equatable {
    var amount: Double?
    var isCredit: Bool
    var at: Date
    var slug: String?
  }

  static let window: TimeInterval = 3 * 60
  var payments: [Payment] = []

  /// An earlier message about this amount, in the same direction, a moment ago.
  func match(amount: Double, isCredit: Bool, at now: Date) -> Payment? {
    payments.last { payment in
      payment.isCredit == isCredit && payment.amount.map { abs($0 - amount) < 0.005 } == true && now.timeIntervalSince(payment.at) <= Self.window
    }
  }

  /// Whether a popup was opened a moment ago, for messages with no text to compare.
  func askedRecently(at now: Date) -> Bool {
    payments.contains { now.timeIntervalSince($0.at) <= Self.window }
  }

  /// Remember a popup, keeping only the last few minutes. Returns its index.
  mutating func record(_ payment: Payment) -> Int {
    payments = payments.filter { payment.at.timeIntervalSince($0.at) <= Self.window }
    payments.append(payment)
    return payments.count - 1
  }
}

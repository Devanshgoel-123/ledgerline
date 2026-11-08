import Foundation

// Today's numbers for the "Today" Live Activity, kept by the app in the App
// Group (src/widget/today.ts writes TodayStats.json after every change) and
// added to by the payment popup between app opens, so the Lock Screen stays
// current without opening Ledgerline. The wording mirrors
// todayActivityProps in src/core/today.ts; tests/today.test.ts
// (CHECK_SWIFT=1) checks both agree.
//
// Foundation only, so it can be checked on a Mac. Copied into the iOS project
// by plugins/withBankMessageIntent.js.

struct TodayStats: Codable, Equatable {
  var date: String
  var spent: Double
  var count: Int
  var toSort: Int
  var limit: Double?
  var last: String?
  /// The app's "Show Today" switch.
  var enabled: Bool?

  /// Moves between your own accounts and investments aren't spending (src/core/today.ts).
  static let notSpending: Set<String> = ["investments", "transfers", "self-transfer", "banks", "cash", "brokerage"]

  static func day(_ date: Date = Date()) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.calendar = Calendar(identifier: .gregorian)
    formatter.dateFormat = "yyyy-MM-dd"
    return formatter.string(from: date)
  }

  /// A payment the popup just logged. Credits only change what's left to sort.
  mutating func add(amount: Double, isCredit: Bool, sorted: Bool, category: String?, root: String?, label: String?, on today: String) {
    if date != today {
      date = today
      spent = 0
      count = 0
      last = nil
    }
    let spending = !isCredit && !Self.notSpending.contains(category ?? "") && !Self.notSpending.contains(root ?? "")
    if spending {
      spent += amount
      count += 1
      last = "\(Self.rupees(amount)) · \(label ?? "Payment")"
    }
    if !sorted { toSort += 1 }
  }

  /// "₹1,240": whole rupees, Indian grouping, like formatInr.
  static func rupees(_ amount: Double) -> String {
    let formatter = NumberFormatter()
    formatter.locale = Locale(identifier: "en_IN")
    formatter.numberStyle = .decimal
    formatter.maximumFractionDigits = 0
    formatter.roundingMode = .halfUp
    return "₹" + (formatter.string(from: NSNumber(value: amount)) ?? String(Int(amount.rounded())))
  }

  /// The activity's props, as JSON the layout reads (TodayActivityProps).
  var props: [String: Any] {
    var detail = count == 0 ? "No payments yet" : count == 1 ? "1 payment" : "\(count) payments"
    var progress = -1.0
    var over = false
    if let limit, limit > 0 {
      let left = limit - spent
      detail += left >= 0 ? " · \(Self.rupees(left)) left" : " · \(Self.rupees(-left)) over"
      progress = min(1, spent / limit)
      over = spent > limit
    }
    return [
      "spent": Self.rupees(spent),
      "detail": detail,
      "toSort": toSort > 0 ? "\(toSort) to sort" : "",
      "progress": progress,
      "over": over,
      "last": last.map { "Last: \($0)" } ?? "",
    ]
  }

  var propsJSON: String? {
    guard let data = try? JSONSerialization.data(withJSONObject: props, options: [.sortedKeys]) else { return nil }
    return String(data: data, encoding: .utf8)
  }
}

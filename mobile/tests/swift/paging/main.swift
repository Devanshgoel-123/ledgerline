import Foundation

// Prints the popup's pages and its repeat-message decisions as JSON, for
// tests/capturePopup.test.ts (CHECK_SWIFT=1).
func pages(_ count: Int) -> [[Int]] {
  var out: [[Int]] = []
  var start = 0
  while start < count {
    let page = CapturePaging.page(count: count, start: start)
    out.append([page.range.lowerBound, page.range.upperBound, page.hasMore ? 1 : 0])
    start = page.range.upperBound
  }
  return out
}

let t0 = Date(timeIntervalSince1970: 1_700_000_000)
var recent = RecentPayments()
_ = recent.record(.init(amount: 250, isCredit: false, at: t0, slug: "food"))
let decisions: [String: Bool] = [
  "sameSoon": recent.match(amount: 250, isCredit: false, at: t0.addingTimeInterval(60)) != nil,
  "sameLater": recent.match(amount: 250, isCredit: false, at: t0.addingTimeInterval(600)) != nil,
  "otherAmount": recent.match(amount: 251, isCredit: false, at: t0.addingTimeInterval(60)) != nil,
  "otherWay": recent.match(amount: 250, isCredit: true, at: t0.addingTimeInterval(60)) != nil,
  "askedSoon": recent.askedRecently(at: t0.addingTimeInterval(120)),
  "askedLater": recent.askedRecently(at: t0.addingTimeInterval(400)),
]
let output: [String: Any] = ["pages": [3, 5, 6, 7, 12, 20].map { [$0: pages($0)].mapKeys() }, "decisions": decisions]
extension Dictionary where Key == Int { func mapKeys() -> [String: Value] { Dictionary<String, Value>(uniqueKeysWithValues: map { (String($0.key), $0.value) }) } }
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: output))

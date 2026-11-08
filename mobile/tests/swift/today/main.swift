import Foundation

// Reads [TodayStats] on stdin and prints each one's Live Activity props, for
// tests/today.test.ts. Also applies one popup payment to the first, to check
// TodayStats.add.
let inputs = try JSONDecoder().decode([TodayStats].self, from: FileHandle.standardInput.readDataToEndOfFile())
var outputs: [[String: Any]] = inputs.map(\.props)
if var first = inputs.first {
  first.add(amount: 640, isCredit: false, sorted: false, category: "food", root: "food", label: "Food & dining", on: "2026-11-09")
  outputs.append(first.props)
}
FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject: outputs))

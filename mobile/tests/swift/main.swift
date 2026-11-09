import Foundation

// Reads [{"text": ..., "sender": ...}] on stdin and prints what
// BankMessagePreview makes of each, for tests/smsPreview.test.ts.
struct Input: Decodable { let text: String; let sender: String? }
struct Output: Encodable { let amount: Double; let isCredit: Bool; let bank: String? }
struct Loose: Encodable { let mightBePayment: Bool; let soundsLikeCredit: Bool }

let inputs = try JSONDecoder().decode([Input].self, from: FileHandle.standardInput.readDataToEndOfFile())
let outputs: [Output?] = inputs.map { input in
  BankMessagePreview.parse(input.text, sender: input.sender).map { Output(amount: $0.amount, isCredit: $0.isCredit, bank: $0.bank) }
}
// With LOOSE=1: what the popup does with a message parse() couldn't read.
if ProcessInfo.processInfo.environment["LOOSE"] == "1" {
  let loose = inputs.map { Loose(mightBePayment: BankMessagePreview.mightBePayment($0.text), soundsLikeCredit: BankMessagePreview.soundsLikeCredit($0.text)) }
  FileHandle.standardOutput.write(try JSONEncoder().encode(loose))
} else {
  FileHandle.standardOutput.write(try JSONEncoder().encode(outputs))
}

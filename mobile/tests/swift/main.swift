import Foundation

// Reads [{"text": ..., "sender": ...}] on stdin and prints what
// BankMessagePreview makes of each, for tests/smsPreview.test.ts.
struct Input: Decodable { let text: String; let sender: String? }
struct Output: Encodable { let amount: Double; let isCredit: Bool; let bank: String? }

let inputs = try JSONDecoder().decode([Input].self, from: FileHandle.standardInput.readDataToEndOfFile())
let outputs: [Output?] = inputs.map { input in
  BankMessagePreview.parse(input.text, sender: input.sender).map { Output(amount: $0.amount, isCredit: $0.isCredit, bank: $0.bank) }
}
FileHandle.standardOutput.write(try JSONEncoder().encode(outputs))

import AppIntents
import Foundation

// "Log bank message": the action a Shortcuts automation runs for every bank
// SMS. It runs in the background without opening Ledgerline and does one
// thing: it writes the message to the App Group folder the app shares with
// its widget. The app reads, parses and saves it (src/capture/inbox.ts) the
// next time it opens. The message never leaves the phone.
//
// Copied into the iOS project by plugins/withBankMessageIntent.js.

@available(iOS 16.0, *)
struct LogBankMessageIntent: AppIntent {
  static let title: LocalizedStringResource = "Log bank message"
  static let description = IntentDescription(
    "Adds the payment in a bank SMS to Ledgerline. The message is read on your device and never sent anywhere."
  )
  static let openAppWhenRun: Bool = false

  @Parameter(title: "Message", description: "The text of the bank SMS.")
  var message: String

  @Parameter(title: "Sender", description: "Who sent it, for example AD-HDFCBK. Optional.")
  var sender: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Log \(\.$message) in Ledgerline") {
      \.$sender
    }
  }

  func perform() async throws -> some IntentResult {
    try LedgerlineMessageInbox.write(text: message, sender: sender)
    return .result()
  }
}

// Lists "Log bank message" under Ledgerline in the Shortcuts app as soon as
// the app is installed, so it's easy to find when setting up the automation
// (and Siri can run it: "Log a bank message in Ledgerline").
@available(iOS 16.0, *)
struct LedgerlineAppShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: LogBankMessageIntent(),
      phrases: ["Log a bank message in \(.applicationName)"],
      shortTitle: "Log bank message",
      systemImageName: "message.badge"
    )
  }
}

enum LedgerlineMessageInbox {
  static let appGroup = "group.app.ledgerline.mobile"
  static let folderName = "MessageInbox"

  enum InboxError: Error, CustomLocalizedStringResourceConvertible {
    case noAppGroup
    var localizedStringResource: LocalizedStringResource {
      "Ledgerline couldn't save the message. Open Ledgerline once, then try again."
    }
  }

  static func write(text: String, sender: String?) throws {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    guard let container = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
      throw InboxError.noAppGroup
    }
    let folder = container.appendingPathComponent(folderName, isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

    var payload: [String: String] = [
      "text": trimmed,
      "receivedAt": ISO8601DateFormatter().string(from: Date()),
    ]
    if let sender, !sender.isEmpty { payload["sender"] = sender }
    let data = try JSONSerialization.data(withJSONObject: payload)

    // One file per message, written atomically, so the app never reads half a file.
    let millis = Int(Date().timeIntervalSince1970 * 1000)
    let name = "\(millis)-\(UUID().uuidString).json"
    try data.write(to: folder.appendingPathComponent(name), options: .atomic)
  }
}

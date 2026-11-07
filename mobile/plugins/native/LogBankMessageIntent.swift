import AppIntents
import Foundation
import UserNotifications

// "Log bank message": the action a Shortcuts automation runs for every bank
// SMS. It runs in the background without opening Ledgerline:
//
// 1. It writes the message to the App Group folder the app shares with its
//    widget. The app reads, parses and saves it (src/capture/inbox.ts) when it
//    next opens, with the full parser, duplicate checks and categories.
// 2. If the message is a payment, it says so right away with a quiet
//    notification ("₹640 spent. Tap to check it"), using a small reader
//    (BankMessagePreview.swift) that agrees with the app's own. Tapping it
//    opens the review screen, where the payment is waiting.
//
// The message never leaves the phone. Copied into the iOS project by
// plugins/withBankMessageIntent.js.

@available(iOS 16.0, *)
struct LogBankMessageIntent: AppIntent {
  static let title: LocalizedStringResource = "Log bank message"
  static let description = IntentDescription(
    "Adds the payment in a bank SMS to Ledgerline. The message is read on your device and never sent anywhere."
  )
  static let openAppWhenRun: Bool = false

  // Optional, so an automation that isn't handing the message over doesn't
  // stop and ask for one each time; the app explains the fix instead.
  @Parameter(title: "Message", description: "The text of the bank SMS. Choose Shortcut Input.")
  var message: String?

  @Parameter(title: "Sender", description: "Who sent it, for example AD-HDFCBK. Optional.")
  var sender: String?

  static var parameterSummary: some ParameterSummary {
    Summary("Log \(\.$message) in Ledgerline") {
      \.$sender
    }
  }

  func perform() async throws -> some IntentResult {
    let text = (message ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    guard !text.isEmpty else {
      try? LedgerlineMessageInbox.markEmptyMessage()
      await LedgerlineCaptureNotice.explainEmptyMessage()
      return .result()
    }
    try LedgerlineMessageInbox.write(text: text, sender: sender)
    if let preview = BankMessagePreview.parse(text, sender: sender) {
      await LedgerlineCaptureNotice.pending(preview, text: text)
    }
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
  /// Written when the automation ran without a message; the app shows how to fix it.
  static let emptyMarker = "CaptureEmptyMessage.json"
  /// The app's switch for these notifications: {"notify": false} turns them off.
  static let settingsFile = "CaptureSettings.json"

  enum InboxError: Error, CustomLocalizedStringResourceConvertible {
    case noAppGroup
    var localizedStringResource: LocalizedStringResource {
      "Ledgerline couldn't save the message. Open Ledgerline once, then try again."
    }
  }

  static func container() throws -> URL {
    guard let url = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroup) else {
      throw InboxError.noAppGroup
    }
    return url
  }

  static func write(text: String, sender: String?) throws {
    let container = try container()
    let folder = container.appendingPathComponent(folderName, isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

    var payload: [String: String] = [
      "text": text,
      "receivedAt": ISO8601DateFormatter().string(from: Date()),
    ]
    if let sender, !sender.isEmpty { payload["sender"] = sender }
    let data = try JSONSerialization.data(withJSONObject: payload)

    // One file per message, written atomically, so the app never reads half a file.
    let millis = Int(Date().timeIntervalSince1970 * 1000)
    let name = "\(millis)-\(UUID().uuidString).json"
    try data.write(to: folder.appendingPathComponent(name), options: .atomic)

    // A message came through, so the automation is set up right.
    try? FileManager.default.removeItem(at: container.appendingPathComponent(emptyMarker))
  }

  static func markEmptyMessage() throws {
    let payload = ["at": ISO8601DateFormatter().string(from: Date())]
    let data = try JSONSerialization.data(withJSONObject: payload)
    try data.write(to: try container().appendingPathComponent(emptyMarker), options: .atomic)
  }

  static func notificationsWanted() -> Bool {
    guard let url = try? container().appendingPathComponent(settingsFile),
          let data = try? Data(contentsOf: url),
          let settings = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return true }
    return settings["notify"] as? Bool ?? true
  }
}

enum LedgerlineCaptureNotice {
  /// The route the app opens when one of these is tapped (src/reminders/schedule.ts).
  static let reviewRoute = "/review"

  private static func allowed() async -> Bool {
    let settings = await UNUserNotificationCenter.current().notificationSettings()
    return settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
  }

  /// "₹640 spent": a quiet banner saying the payment is in and waiting for a look.
  static func pending(_ preview: BankMessagePreview, text: String) async {
    guard LedgerlineMessageInbox.notificationsWanted(), await allowed() else { return }
    let content = UNMutableNotificationContent()
    content.title = "\(preview.formattedAmount) \(preview.isCredit ? "received" : "spent")"
    content.body = preview.bank.map { "From your \($0) message. Tap to check it in Ledgerline." }
      ?? "From a bank message. Tap to check it in Ledgerline."
    content.threadIdentifier = "captured"
    content.userInfo = ["url": reviewRoute]
    // The bank's SMS already made a sound.
    content.sound = nil
    // The same message twice replaces its notification instead of adding one.
    let id = "captured-\(stableHash(text))"
    try? await UNUserNotificationCenter.current().add(UNNotificationRequest(identifier: id, content: content, trigger: nil))
  }

  /// FNV-1a, the same on every launch (String.hashValue is not).
  private static func stableHash(_ text: String) -> String {
    var hash: UInt32 = 0x811c_9dc5
    for byte in text.utf8 {
      hash ^= UInt32(byte)
      hash = hash &* 0x0100_0193
    }
    return String(hash, radix: 36)
  }

  /// At most once a day: the automation is running but not handing over the message.
  static func explainEmptyMessage() async {
    let defaults = UserDefaults(suiteName: LedgerlineMessageInbox.appGroup)
    let last = defaults?.double(forKey: "emptyMessageNoticeAt") ?? 0
    let now = Date().timeIntervalSince1970
    guard now - last > 86_400, await allowed() else { return }
    defaults?.set(now, forKey: "emptyMessageNoticeAt")
    let content = UNMutableNotificationContent()
    content.title = "Ledgerline didn't get the message"
    content.body = "In your Shortcuts automation, tap Message in “Log bank message” and choose Shortcut Input."
    content.userInfo = ["url": "/auto-capture"]
    try? await UNUserNotificationCenter.current().add(
      UNNotificationRequest(identifier: "capture-empty-message", content: content, trigger: nil)
    )
  }
}

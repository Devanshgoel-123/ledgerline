import AppIntents
import Foundation
import UserNotifications
#if canImport(ActivityKit)
import ActivityKit
#endif

// "Log bank message": the action a Shortcuts automation runs for every SMS.
// It runs without opening Ledgerline:
//
// 1. For a payment, it asks right there, in a small popup over whatever you
//    are doing: "₹640 spent. What was it for?" with your categories as
//    buttons. When the amount can't be read (or the automation handed over no
//    text at all), it asks for the amount first.
// 2. It writes the message and your answer to the App Group folder the app
//    shares with its widget. The app adds the entry when it next opens
//    (src/capture/inbox.ts, src/core/capture.ts), with your amount and
//    category, its full parser, and duplicate checks.
// 3. If you dismiss the popup, or iOS can't show it (a locked phone), the
//    payment is still saved and a notification stays behind to check it later.
//
// Chats, OTPs and offers are saved for the app to ignore, with no popup.
// The message never leaves the phone. Copied into the iOS project by
// plugins/withBankMessageIntent.js.

@available(iOS 16.0, *)
struct LogBankMessageIntent: AppIntent {
  static let title: LocalizedStringResource = "Log bank message"
  static let description = IntentDescription(
    "Adds the payment in a bank SMS to Ledgerline, asking for its category. The message is read on your device and never sent anywhere."
  )
  static let openAppWhenRun: Bool = false

  // Optional, so an automation that isn't handing the message over still
  // runs: the popup asks for the amount instead.
  @Parameter(title: "Message", description: "The text of the bank SMS. Choose Shortcut Input.")
  var message: String?

  @Parameter(title: "Sender", description: "Who sent it, for example AD-HDFCBK. Optional.")
  var sender: String?

  // Asked for in the popup; leave them empty in Shortcuts.
  @Parameter(title: "Amount", description: "Asked for when the message has no amount Ledgerline can read.")
  var amount: Double?

  @Parameter(title: "Category", description: "Asked for each time. Set it only to file every payment in one category.")
  var category: CaptureCategory?

  static var parameterSummary: some ParameterSummary {
    Summary("Log \(\.$message) in Ledgerline") {
      \.$sender
      \.$amount
      \.$category
    }
  }

  func perform() async throws -> some IntentResult {
    let text = (message ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
    let preview = text.isEmpty ? nil : BankMessagePreview.parse(text, sender: sender)
    let now = Date()
    var recent = LedgerlineRecent.load()

    if text.isEmpty {
      try? LedgerlineMessageInbox.markEmptyMessage()
      // No text to tell one message from another: one popup per payment, not one per SMS.
      if recent.askedRecently(at: now) { return .result() }
    } else if preview == nil && !BankMessagePreview.mightBePayment(text) {
      // A chat, an OTP, an offer, a balance: nothing to ask, and nothing kept.
      // The app's reader agrees with this one (tests/smsPreview.test.ts), so
      // it would skip it too; a friend's message is never written anywhere.
      return .result()
    } else if let preview, let earlier = recent.match(amount: preview.amount, isCredit: preview.isCredit, at: now) {
      // The bank's second message about the payment you were just asked about.
      // Logged quietly (the app matches it to the first), so it never opens a
      // popup over the one you're answering.
      try LedgerlineMessageInbox.write(
        text: text, sender: sender,
        answer: .init(amount: nil, type: preview.isCredit ? "credit" : "debit", categorySlug: earlier.slug, repeat: true)
      )
      return .result()
    }

    let isCredit = preview?.isCredit ?? BankMessagePreview.soundsLikeCredit(text)
    var paid: Double? = preview?.amount
    var picked: CaptureCategory? = category?.id == CaptureCategory.moreID ? nil : category
    // Claim this payment before asking, so messages arriving while the popup is open stay quiet.
    let slot = recent.record(.init(amount: paid, isCredit: isCredit, at: now, slug: nil))
    recent.save()

    do {
      if paid == nil {
        if text.isEmpty {
          try await requestConfirmation(
            result: .result(dialog: "A message came in, but Ledgerline couldn't see its text. Was it a payment? (To fix this, set Message to Shortcut Input in your automation.)"),
            confirmationActionName: .add,
            showPrompt: false
          )
        }
        let typed = try await $amount.requestValue(
          text.isEmpty ? "How much was it?" : "Ledgerline couldn't read the amount in this message. How much was it?"
        )
        paid = typed > 0 ? (typed * 100).rounded() / 100 : nil
        recent.payments[slot].amount = paid
        recent.save()
      }
      if let paid, picked == nil {
        let what = "\(BankMessagePreview.format(paid)) \(isCredit ? "received" : "spent")"
        let from = preview?.bank.map { " from your \($0) account" } ?? ""
        picked = try await pickCategory(credit: isCredit, dialog: "\(what)\(from). \(isCredit ? "What was it?" : "What was it for?")")
      }
    } catch {
      // Dismissed, or iOS couldn't show the popup (the phone was locked).
      // Whatever we have is kept; the notification below is the reminder.
    }

    recent.payments[slot].slug = picked?.id
    recent.save()

    guard !text.isEmpty || paid != nil else { return .result() }
    let answer = LedgerlineMessageInbox.Answer(
      amount: preview == nil ? paid : nil,
      type: isCredit ? "credit" : "debit",
      categorySlug: picked?.id
    )
    try LedgerlineMessageInbox.write(text: text, sender: sender, answer: answer)

    // Keep "Today" on the Lock Screen current.
    if let paid {
      await LedgerlineToday.add(
        amount: paid, isCredit: isCredit, sorted: picked != nil,
        category: picked?.id, root: picked?.root, label: picked?.label ?? preview?.bank.map { "\($0) SMS" }
      )
    }

    // Not sorted yet: leave a quiet notification to come back to.
    if picked == nil, let paid {
      await LedgerlineCaptureNotice.pending(amount: BankMessagePreview.format(paid), isCredit: isCredit, bank: preview?.bank, key: text.isEmpty ? UUID().uuidString : text)
    }
    return .result()
  }

  /// Your five most used categories and "More categories", which pages
  /// through the rest six at a time (CapturePaging): short lists the popup
  /// shows without scrolling, in the same order as Quick add.
  private func pickCategory(credit: Bool, dialog: String) async throws -> CaptureCategory? {
    let all = CaptureCategory.choices(credit: credit)
    var start = 0
    while start < all.count {
      let page = CapturePaging.page(count: all.count, start: start)
      var options = Array(all[page.range])
      if page.hasMore { options.append(.more) }
      let prompt = start == 0 ? dialog : "\(dialog) More categories:"
      let choice = try await $category.requestDisambiguation(among: options, dialog: IntentDialog(stringLiteral: prompt))
      if choice.id != CaptureCategory.moreID { return choice }
      start = page.range.upperBound
    }
    return nil
  }
}

/// A category the popup offers. The list comes from the app
/// (CaptureCategories.json, most used first, written by src/state/ledger.tsx);
/// until the app has written it, a built-in list matching src/core/taxonomy.ts.
@available(iOS 16.0, *)
struct CaptureCategory: AppEntity {
  static let typeDisplayRepresentation: TypeDisplayRepresentation = "Category"
  static let defaultQuery = CaptureCategoryQuery()

  let id: String
  let label: String
  let root: String

  var displayRepresentation: DisplayRepresentation {
    DisplayRepresentation(title: "\(label)", image: .init(systemName: Self.symbol(root)))
  }

  private static let symbols: [String: String] = [
    "food": "fork.knife", "grocery": "cart", "shopping": "bag", "transport": "car",
    "travel": "airplane", "bills": "bolt", "household": "house", "subscriptions": "play.rectangle",
    "outing": "ticket", "healthcare": "cross.case", "personal": "scissors", "education": "book",
    "family": "person.2", "gifts": "gift", "vices": "wineglass", "emi": "building.columns",
    "insurance": "shield", "fees": "doc.text", "investments": "chart.line.uptrend.xyaxis",
    "transfers": "arrow.left.arrow.right", "income": "indianrupeesign.circle", "other": "ellipsis.circle",
    "more": "chevron.down.circle",
  ]

  static func symbol(_ root: String) -> String { symbols[root] ?? "tag" }

  /// The last button on a page of the popup: shows the next categories.
  static let moreID = "more"
  static let more = CaptureCategory(id: moreID, label: "More categories", root: "more")

  /// Used before the app has written its list: exactly what
  /// src/core/quick.ts popupCategories gives with no history yet
  /// (tests/capturePopup.test.ts checks they match).
  static let fallback: [String: [CaptureCategory]] = [
    "debit": [
      ("food", "Food & dining", "food"), ("grocery", "Groceries", "grocery"), ("shopping", "Shopping", "shopping"),
      ("transport", "Transport", "transport"), ("travel", "Travel", "travel"), ("bills", "Bills & utilities", "bills"),
      ("household", "Home", "household"), ("subscriptions", "Subscriptions", "subscriptions"), ("outing", "Entertainment", "outing"),
      ("healthcare", "Health", "healthcare"), ("personal", "Personal care", "personal"), ("education", "Education", "education"),
      ("family", "Family & kids", "family"), ("gifts", "Gifts & donations", "gifts"), ("vices", "Drinks & smokes", "vices"),
      ("emi", "Loans & EMI", "emi"), ("insurance", "Insurance", "insurance"), ("fees", "Taxes & fees", "fees"),
      ("investments", "Investments", "investments"), ("other", "Other", "other"),
    ].map { CaptureCategory(id: $0.0, label: $0.1, root: $0.2) },
    "credit": [
      ("salary", "Salary", "income"), ("refunds", "Refunds & cashback", "income"), ("from-home", "From family", "income"),
      ("interest", "Interest & dividends", "income"), ("transfers", "Transfers", "transfers"),
      ("investments", "Investments", "investments"), ("other-income", "Other income", "income"),
    ].map { CaptureCategory(id: $0.0, label: $0.1, root: $0.2) },
  ]

  static func choices(credit: Bool) -> [CaptureCategory] {
    let key = credit ? "credit" : "debit"
    if let url = try? LedgerlineMessageInbox.container().appendingPathComponent(LedgerlineMessageInbox.categoriesFile),
       let data = try? Data(contentsOf: url),
       let lists = try? JSONDecoder().decode([String: [Choice]].self, from: data),
       let list = lists[key], !list.isEmpty {
      return list.map { CaptureCategory(id: $0.slug, label: $0.label, root: $0.root) }
    }
    return fallback[key] ?? []
  }

  private struct Choice: Decodable { let slug: String; let label: String; let root: String }
}

@available(iOS 16.0, *)
struct CaptureCategoryQuery: EntityQuery {
  func entities(for identifiers: [String]) async throws -> [CaptureCategory] {
    let all = CaptureCategory.choices(credit: false) + CaptureCategory.choices(credit: true) + [.more]
    return identifiers.compactMap { id in all.first { $0.id == id } }
  }

  func suggestedEntities() async throws -> [CaptureCategory] {
    CaptureCategory.choices(credit: false)
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
  /// The popup's categories, written by the app (src/capture/inbox.ts).
  static let categoriesFile = "CaptureCategories.json"

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

  /// What you told the popup; the app reads it in src/capture/inbox.ts.
  struct Answer {
    /// Only when the message had no amount Ledgerline could read.
    var amount: Double?
    var type: String
    var categorySlug: String?
    /// Another message about a payment the popup just handled.
    var `repeat`: Bool = false
  }

  static func write(text: String, sender: String?, answer: Answer?) throws {
    let container = try container()
    let folder = container.appendingPathComponent(folderName, isDirectory: true)
    try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)

    var payload: [String: Any] = [
      "text": text,
      "receivedAt": ISO8601DateFormatter().string(from: Date()),
    ]
    if let sender, !sender.isEmpty { payload["sender"] = sender }
    if let answer {
      var fields: [String: Any] = ["type": answer.type]
      if let amount = answer.amount { fields["amount"] = amount }
      if let slug = answer.categorySlug { fields["categorySlug"] = slug }
      if answer.repeat { fields["repeat"] = true }
      payload["answer"] = fields
    }
    let data = try JSONSerialization.data(withJSONObject: payload)

    // One file per message, written atomically, so the app never reads half a file.
    let millis = Int(Date().timeIntervalSince1970 * 1000)
    let name = "\(millis)-\(UUID().uuidString).json"
    try data.write(to: folder.appendingPathComponent(name), options: .atomic)

    // A message came through, so the automation is set up right.
    if !text.isEmpty { try? FileManager.default.removeItem(at: container.appendingPathComponent(emptyMarker)) }
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

/// RecentPayments (CapturePaging.swift), kept in the App Group so each run
/// of the automation sees what the one before it asked.
enum LedgerlineRecent {
  static let file = "CaptureRecent.json"

  static func load() -> RecentPayments {
    guard let url = try? LedgerlineMessageInbox.container().appendingPathComponent(file),
          let data = try? Data(contentsOf: url),
          let recent = try? JSONDecoder().decode(RecentPayments.self, from: data) else { return RecentPayments() }
    return recent
  }
}

extension RecentPayments {
  func save() {
    guard let url = try? LedgerlineMessageInbox.container().appendingPathComponent(LedgerlineRecent.file),
          let data = try? JSONEncoder().encode(self) else { return }
    try? data.write(to: url, options: .atomic)
  }
}

enum LedgerlineCaptureNotice {
  /// The route the app opens when one of these is tapped (src/reminders/schedule.ts).
  static let reviewRoute = "/review"

  private static func allowed() async -> Bool {
    let settings = await UNUserNotificationCenter.current().notificationSettings()
    return settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional
  }

  /// "₹640 spent": a quiet notification for a payment you haven't sorted yet.
  /// It stays in Notification Center; tapping it opens the review screen.
  static func pending(amount: String, isCredit: Bool, bank: String?, key: String) async {
    guard LedgerlineMessageInbox.notificationsWanted(), await allowed() else { return }
    let content = UNMutableNotificationContent()
    content.title = "\(amount) \(isCredit ? "received" : "spent")"
    content.body = bank.map { "From your \($0) message. Tap to pick its category." }
      ?? "Saved in Ledgerline. Tap to pick its category."
    content.threadIdentifier = "captured"
    content.userInfo = ["url": reviewRoute]
    // The bank's SMS already made a sound.
    content.sound = nil
    // The same message twice replaces its notification instead of adding one.
    let id = "captured-\(stableHash(key))"
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
}

/// The "Today" Live Activity the app starts (src/widget/today.ts): the popup
/// adds each payment to TodayStats.json and redraws the activity.
enum LedgerlineToday {
  static let file = "TodayStats.json"
  /// The name src/widget/TodayActivity.tsx registers with createLiveActivity.
  static let activityName = "TodayStats"

  static func add(amount: Double, isCredit: Bool, sorted: Bool, category: String?, root: String?, label: String?) async {
    guard let url = try? LedgerlineMessageInbox.container().appendingPathComponent(file),
          let data = try? Data(contentsOf: url),
          var stats = try? JSONDecoder().decode(TodayStats.self, from: data),
          stats.enabled != false else { return }
    stats.add(amount: amount, isCredit: isCredit, sorted: sorted, category: category, root: root, label: label, on: TodayStats.day())
    if let encoded = try? JSONEncoder().encode(stats) { try? encoded.write(to: url, options: .atomic) }
    await redraw(stats)
  }

  private static func redraw(_ stats: TodayStats) async {
    #if canImport(ActivityKit) && os(iOS)
    guard #available(iOS 16.2, *), let props = stats.propsJSON else { return }
    var midnight = Calendar.current.startOfDay(for: Date())
    midnight = Calendar.current.date(byAdding: .day, value: 1, to: midnight) ?? midnight
    for activity in Activity<LiveActivityAttributes>.activities where activity.content.state.name == activityName {
      let state = LiveActivityAttributes.ContentState(name: activityName, props: props)
      await activity.update(ActivityContent(state: state, staleDate: midnight))
    }
    #endif
  }
}

#if canImport(ActivityKit) && os(iOS)
/// The same name and shape as expo-widgets' own attributes
/// (node_modules/expo-widgets/ios/Widgets/WidgetLiveActivity.swift), which
/// the widget extension draws. ActivityKit matches activities by this type's
/// name, so the popup can update the activity the app started.
@available(iOS 16.1, *)
struct LiveActivityAttributes: ActivityAttributes {
  var url: String?

  public struct ContentState: Codable, Hashable {
    var name: String
    var props: String?
  }
}
#endif

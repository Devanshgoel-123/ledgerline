# App Review notes (App Store Connect → App Review Information → Notes)

Paste everything between the lines into the Notes field (under 4,000 characters).
Attach the screen recording in the same section, or paste its link where marked.

---

1. SCREEN RECORDING
Recorded on a physical iPhone running the latest iOS, starting from app launch: [attached / LINK]
It shows onboarding, adding an expense, the Insights and People tabs, editing and deleting an entry, logging a bank SMS (pasted, and through the Shortcuts automation with its popup), the Today Live Activity, app lock, and backup/export.
There is no account registration, login, user-generated content shared with others, or paid content, so none of those flows exist.

2. PURPOSE AND AUDIENCE
Ledgerline is a private, offline expense tracker for people in India who pay mostly by UPI and cards. The problem: bank SMS and statements show payments, but not where the money went. Ledgerline turns them into a categorised record (food, rent, transport…) with monthly insights, a daily limit, and splits with friends. All data stays on the phone. There is no account, no server, and no bank login.

3. HOW TO USE IT (no login needed)
- Open the app. On the welcome screen tap "Look around with a sample month" to load demo data, or "Start" for an empty ledger.
- Add an expense: Overview → "Add expense" (amount → category). Tap any entry under Transactions to edit or delete it.
- Insights: the Overview and Insights tabs show where the money went, month by month. People tracks splits with friends.
- Bank SMS (no SMS access is needed on iOS): Settings → "Add payments from bank SMS" → "Paste a bank message". Paste this sample:
  Sent Rs.250.00 From HDFC Bank A/C *1234 To SWIGGY On 05/11/26 Ref 532912345678 Not You? Call 18002586161
  It is added as ₹250 at Swiggy, under Food.
- Optional automatic capture: iOS apps can't read SMS, so the user creates a Shortcuts automation (Message trigger → Ledgerline's "Log bank message" action, Message = Shortcut Input). When a bank SMS arrives, a popup shows the amount and asks for a category, without opening the app. Setup steps are on the same screen.
- Today Live Activity: today's spend on the Lock Screen and in the Dynamic Island. Settings → "Show Today".
- Statements: Overview → "Statement" → import a bank CSV or PDF statement exported from the user's bank.
- Settings: daily limit, reminders, Face ID app lock, backup/restore (a JSON file via the share sheet), CSV export, erase everything.

4. EXTERNAL SERVICES
None. No analytics, ads, AI, payment processor, authentication or data provider. Everything is processed on the device. The app makes no network requests. The only outside link is an optional "Share on X" button, which opens a post draft on x.com in the browser.

5. REGIONAL DIFFERENCES
The app works the same in every region. Amounts are in Indian rupees and the SMS reader understands Indian bank formats (HDFC, ICICI, SBI, Axis, Kotak and others), because the app is built for Indian users. Everything else (manual entry, categories, insights, statements) is the same everywhere.

6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not applicable. Ledgerline does not move money, connect to banks, give financial advice, or offer loans, credit or investments. It is a personal record the user keeps on their own device. Bank and shop names appear only as text the user's own messages contain. Shop logos are used only to label the user's own transactions.

Privacy policy: https://ledgerline-silk.vercel.app/privacy

---

## Screen recording checklist (on your iPhone, latest iOS)

Control Center → Screen Recording. Keep it about 2–3 minutes and start from the Home Screen:

1. Tap the Ledgerline icon (the recording must begin with launching the app).
2. Welcome → "Look around with a sample month".
3. Overview → scroll; open the Insights tab; open People.
4. Overview → Add expense → ₹120 → Cafés → save. Transactions → open it → edit → delete.
5. Overview → Statement (show the import screen).
6. Settings → Add payments from bank SMS → Paste a bank message → paste the sample → it's added.
7. If the automation is set up: send yourself the sample SMS, and show the popup → pick a category.
8. Lock the phone: show "Today" on the Lock Screen.
9. Settings → app lock (Face ID), Backup, Export CSV, Erase (show the confirm only).

Upload it as the attachment in App Review Information, or as an unlisted link pasted into section 1.

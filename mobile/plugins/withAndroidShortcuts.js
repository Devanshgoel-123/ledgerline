// Long-press the app icon on Android: "Add expense" and "Upload statement".
// Static app shortcuts are an XML resource plus one <meta-data> on the main
// activity, so this stays a few lines instead of a native dependency. Each
// shortcut opens a deep link that Expo Router already handles.
const fs = require("fs");
const path = require("path");
const { AndroidConfig, withAndroidManifest, withDangerousMod, withStringsXml } = require("expo/config-plugins");

const SHORTCUTS = [
  { id: "quick_add", url: "ledgerline://quick", short: "Add expense", long: "Add an expense", icon: "ic_shortcut_add" },
  { id: "statement", url: "ledgerline://statement", short: "Upload statement", long: "Upload a bank statement", icon: "ic_shortcut_statement" },
];

// Material Symbols "add" and "upload_file", on the brand indigo circle.
const ICONS = {
  ic_shortcut_add: "M11,17h2v-4h4v-2h-4V7h-2v4H7v2h4V17z",
  ic_shortcut_statement:
    "M11,19h2v-4.2l1.6,1.6L16,15l-4,-4l-4,4l1.4,1.4l1.6,-1.6V19zM8,22q-0.8,0 -1.4,-0.6T6,20V4q0,-0.8 0.6,-1.4T8,2h8l6,6v12q0,0.8 -0.6,1.4T20,22H8zM15,9V4H8v16h12V9H15z",
};

function iconXml(pathData) {
  return `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="48dp" android:height="48dp" android:viewportWidth="24" android:viewportHeight="24">
  <path android:fillColor="#4F46E5" android:pathData="M12,0a12,12 0 1,0 0.01,0z"/>
  <group android:scaleX="0.6" android:scaleY="0.6" android:pivotX="12" android:pivotY="12">
    <path android:fillColor="#FFFFFF" android:pathData="${pathData}"/>
  </group>
</vector>
`;
}

function shortcutsXml(packageName) {
  const items = SHORTCUTS.map(
    (s) => `  <shortcut
      android:shortcutId="${s.id}"
      android:enabled="true"
      android:icon="@drawable/${s.icon}"
      android:shortcutShortLabel="@string/shortcut_${s.id}_short"
      android:shortcutLongLabel="@string/shortcut_${s.id}_long">
    <intent
        android:action="android.intent.action.VIEW"
        android:data="${s.url}"
        android:targetPackage="${packageName}"
        android:targetClass="${packageName}.MainActivity" />
  </shortcut>`,
  ).join("\n");
  return `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
${items}
</shortcuts>
`;
}

module.exports = function withAndroidShortcuts(config) {
  config = withStringsXml(config, (cfg) => {
    for (const s of SHORTCUTS) {
      cfg.modResults = AndroidConfig.Strings.setStringItem(
        [
          { $: { name: `shortcut_${s.id}_short` }, _: s.short },
          { $: { name: `shortcut_${s.id}_long` }, _: s.long },
        ],
        cfg.modResults,
      );
    }
    return cfg;
  });

  config = withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    activity["meta-data"] = (activity["meta-data"] ?? []).filter((m) => m.$["android:name"] !== "android.app.shortcuts");
    activity["meta-data"].push({ $: { "android:name": "android.app.shortcuts", "android:resource": "@xml/shortcuts" } });
    return cfg;
  });

  return withDangerousMod(config, [
    "android",
    (cfg) => {
      const packageName = cfg.android?.package;
      if (!packageName) throw new Error("withAndroidShortcuts: set android.package in app.json");
      const res = path.join(cfg.modRequest.platformProjectRoot, "app", "src", "main", "res");
      fs.mkdirSync(path.join(res, "xml"), { recursive: true });
      fs.mkdirSync(path.join(res, "drawable"), { recursive: true });
      fs.writeFileSync(path.join(res, "xml", "shortcuts.xml"), shortcutsXml(packageName));
      for (const [name, data] of Object.entries(ICONS)) {
        fs.writeFileSync(path.join(res, "drawable", `${name}.xml`), iconXml(data));
      }
      return cfg;
    },
  ]);
};

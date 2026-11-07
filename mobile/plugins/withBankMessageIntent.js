// Adds the "Log bank message" App Intent (plugins/native/LogBankMessageIntent.swift)
// to the iOS app target. A Shortcuts automation runs it for each bank SMS; it
// writes the message to the App Group inbox, and the app picks it up
// (src/capture/inbox.ts). The App Group itself comes from expo-widgets, which
// adds group.app.ledgerline.mobile to the app's entitlements; this plugin adds
// it too, so capture keeps working if the widget is ever removed.
const fs = require("fs");
const path = require("path");
const { IOSConfig, withDangerousMod, withEntitlementsPlist, withXcodeProject } = require("expo/config-plugins");

// The action, and the small reader it uses to notify you about a payment.
const FILES = ["LogBankMessageIntent.swift", "BankMessagePreview.swift"];
const APP_GROUP = "group.app.ledgerline.mobile";

module.exports = function withBankMessageIntent(config) {
  config = withEntitlementsPlist(config, (cfg) => {
    const key = "com.apple.security.application-groups";
    const groups = new Set(cfg.modResults[key] ?? []);
    groups.add(APP_GROUP);
    cfg.modResults[key] = [...groups];
    return cfg;
  });

  config = withDangerousMod(config, [
    "ios",
    (cfg) => {
      const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
      for (const file of FILES) {
        fs.copyFileSync(path.join(__dirname, "native", file), path.join(cfg.modRequest.platformProjectRoot, projectName, file));
      }
      return cfg;
    },
  ]);

  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const app = IOSConfig.XcodeUtils.getApplicationNativeTarget({ project, projectName });
    for (const file of FILES) {
      const filepath = `${projectName}/${file}`;
      if (!project.hasFile(filepath)) {
        IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: projectName, project, targetUuid: app.uuid });
      }
    }
    return cfg;
  });
};

// Adds the "Log bank message" App Intent (plugins/native/LogBankMessageIntent.swift)
// to the iOS app target. A Shortcuts automation runs it for each bank SMS; it
// writes the message to the App Group inbox, and the app picks it up
// (src/capture/inbox.ts). The App Group itself comes from expo-widgets, which
// adds group.app.ledgerline.mobile to the app's entitlements; this plugin adds
// it too, so capture keeps working if the widget is ever removed.
const fs = require("fs");
const path = require("path");
const { IOSConfig, withDangerousMod, withEntitlementsPlist, withXcodeProject } = require("expo/config-plugins");

const SOURCE = path.join(__dirname, "native", "LogBankMessageIntent.swift");
const FILE = "LogBankMessageIntent.swift";
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
      const target = path.join(cfg.modRequest.platformProjectRoot, projectName, FILE);
      fs.copyFileSync(SOURCE, target);
      return cfg;
    },
  ]);

  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(cfg.modRequest.projectRoot);
    const filepath = `${projectName}/${FILE}`;
    if (!project.hasFile(filepath)) {
      const app = IOSConfig.XcodeUtils.getApplicationNativeTarget({ project, projectName });
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: projectName, project, targetUuid: app.uuid });
    }
    return cfg;
  });
};

// The app reuses the backend's pure TypeScript (statement parsers, matching,
// categorising, spend totals) straight from backend/src, so both read a
// statement the same way. Those files import siblings as "./x.js" (Node ESM);
// Metro is told to try the .ts file first.
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const shared = path.resolve(__dirname, "../backend/src");

config.watchFolders = [...(config.watchFolders ?? []), shared];

const resolveDefault = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith("@shared/")) {
    const target = path.join(shared, moduleName.slice("@shared/".length)).replace(/\.js$/, ".ts");
    return { type: "sourceFile", filePath: target };
  }
  if (
    moduleName.startsWith(".") &&
    moduleName.endsWith(".js") &&
    context.originModulePath.startsWith(shared)
  ) {
    const candidate = path.resolve(path.dirname(context.originModulePath), moduleName.replace(/\.js$/, ".ts"));
    return { type: "sourceFile", filePath: candidate };
  }
  return (resolveDefault ?? context.resolveRequest)(context, moduleName, platform);
};

// Web build only: expo-sqlite runs SQLite as WebAssembly, which needs these
// two headers for SharedArrayBuffer.
config.resolver.assetExts = [...config.resolver.assetExts, "wasm"];
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader("Cross-Origin-Embedder-Policy", "credentialless");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  return middleware(req, res, next);
};

module.exports = config;

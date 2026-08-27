// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build ships a WASM engine — Metro must treat it as an asset.
config.resolver.assetExts.push("wasm");

module.exports = config;

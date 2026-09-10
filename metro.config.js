// Learn more: https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// expo-sqlite (web, alpha): bundle the wa-sqlite wasm module as an asset
config.resolver.assetExts.push('wasm');

module.exports = config;

const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Exclude cache dirs from file watching to prevent ENOSPC errors.
config.resolver.blockList = [
  /\/\.cache\/.*/,
  /\/\.bun\/.*/,
];

module.exports = config;

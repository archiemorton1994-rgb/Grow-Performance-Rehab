const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Exclude cache dirs and internal agent dirs from file watching to prevent ENOSPC errors
// and Metro crashes when stale watch paths are removed mid-session.
config.resolver.blockList = [
  /\/\.cache\/.*/,
  /\/\.bun\/.*/,
  /\/\.local\/.*/,
];

module.exports = config;

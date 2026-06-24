const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// Exclude the .cache directory from file watching to prevent ENOSPC errors.
// The .cache dir contains bun/yarn install caches with tens of thousands of
// subdirectories that exhaust the OS inotify file-watcher limit.
config.resolver.blockList = [
  /\/\.cache\/.*/,
  /\/\.bun\/.*/,
];

module.exports = config;

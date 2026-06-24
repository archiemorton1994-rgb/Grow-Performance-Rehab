const { getDefaultConfig } = require("expo/metro-config");
const { createProxyMiddleware } = require("http-proxy-middleware");

const config = getDefaultConfig(__dirname);

// Exclude cache dirs from file watching to prevent ENOSPC errors.
config.resolver.blockList = [
  /\/\.cache\/.*/,
  /\/\.bun\/.*/,
];

// Metro runs on port 5000 (the webview port) so the Replit preview serves
// the Expo web app directly — no Express proxy in the hot path.
//
// enhanceMiddleware:
//   1. Rewrites external Host headers so Metro's built-in host-check accepts them.
//   2. Proxies /api/* to the Express API backend.
const METRO_PORT   = process.env.METRO_PORT   || '5000';
const EXPRESS_PORT = process.env.EXPRESS_PORT || '5001';

const apiProxy = createProxyMiddleware({
  target: `http://127.0.0.1:${EXPRESS_PORT}`,
  changeOrigin: false,
  on: {
    error: (err, _req, res) => {
      console.error('[Metro→Express proxy error]', err.message);
      if (res && !res.headersSent) {
        res.writeHead(502);
        res.end('API proxy error: ' + err.message);
      }
    },
  },
});

config.server = {
  enhanceMiddleware: (metroMiddleware) => {
    return (req, res, next) => {
      // Rewrite external Host headers (coming via Replit's reverse proxy) so
      // Metro's built-in host-check allows the request.
      const host = (req.headers && req.headers['host']) || '';
      if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
        req.headers['host'] = `localhost:${METRO_PORT}`;
      }

      // Proxy API requests to the Express backend.
      if ((req.url || '').startsWith('/api')) {
        return apiProxy(req, res, next);
      }

      return metroMiddleware(req, res, next);
    };
  },
};

module.exports = config;

import express from "express";
import type { Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { runMigrations } from "./db";
import * as fs from "fs";
import * as path from "path";
import * as http from "node:http";
import { createProxyMiddleware } from "http-proxy-middleware";

const app = express();
const log = console.log;

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

function setupCors(app: express.Application) {
  app.use((req, res, next) => {
    const origins = new Set<string>();

    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }

    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }

    const origin = req.header("origin");

    // Allow localhost origins for Expo web development (any port)
    const isLocalhost =
      origin?.startsWith("http://localhost:") ||
      origin?.startsWith("http://127.0.0.1:");

    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS",
      );
      res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
      res.header("Access-Control-Allow-Credentials", "true");
    }

    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }

    next();
  });
}

function setupBodyParsing(app: express.Application) {
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));
}

function setupRequestLogging(app: express.Application) {
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, unknown> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      if (!path.startsWith("/api")) return;

      const duration = Date.now() - start;

      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        const isAuthRoute = path.startsWith('/api/auth');
        const logBody = isAuthRoute
          ? Object.fromEntries(
              Object.entries(capturedJsonResponse).map(([k, v]) =>
                k === 'token' ? [k, '[REDACTED]'] : [k, v]
              )
            )
          : capturedJsonResponse;
        logLine += ` :: ${JSON.stringify(logBody)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    });

    next();
  });
}

function getAppName(): string {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}

function serveExpoManifest(platform: string, res: Response) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json",
  );

  if (!fs.existsSync(manifestPath)) {
    return res
      .status(404)
      .json({ error: `Manifest not found for platform: ${platform}` });
  }

  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");

  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}

function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName,
}: {
  req: Request;
  res: Response;
  landingPageTemplate: string;
  appName: string;
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;

  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);

  const html = landingPageTemplate
    .replace(/BASE_URL_PLACEHOLDER/g, baseUrl)
    .replace(/EXPS_URL_PLACEHOLDER/g, expsUrl)
    .replace(/APP_NAME_PLACEHOLDER/g, appName);

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}

function configureExpoAndLanding(app: express.Application) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html",
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();

  log("Serving static Expo files with dynamic manifest routing");

  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }

    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }

    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName,
      });
    }

    next();
  });

  app.use("/assets", express.static(path.resolve(process.cwd(), "assets")));
  app.use(express.static(path.resolve(process.cwd(), "static-build")));

  log("Expo routing: Checking expo-platform header on / and /manifest");
}

// Metro compiles the (~13 MB) dev bundle lazily on the first request, which
// takes ~12 s. During that cold build, Replit's external port tunnels can drop
// the connection before the first byte arrives, leaving Expo Go / the iOS
// simulator stuck on "loading". Pre-warming each platform's bundle right after
// Metro is ready populates Metro's cache so every real device request is served
// warm (<1 s) over the standard dev domain.
function prewarmMetroBundles() {
  if (process.env.NODE_ENV !== "development") return;

  const METRO_PORT = process.env.METRO_PORT || "8082";
  const base = `http://127.0.0.1:${METRO_PORT}`;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const bundleParams =
    "dev=true&hot=false&lazy=true&transform.engine=hermes&transform.bytecode=1&transform.routerRoot=app&transform.reactCompiler=true&unstable_transformProfile=hermes-stable";

  void (async () => {
    let ready = false;
    for (let i = 0; i < 120; i++) {
      try {
        const r = await fetch(`${base}/status`);
        if (r.ok) {
          ready = true;
          break;
        }
      } catch {
        // Metro not up yet - keep polling.
      }
      await sleep(2000);
    }

    if (!ready) {
      log("[prewarm] Metro did not become ready; skipping bundle pre-warm");
      return;
    }

    for (const platform of ["ios", "android"]) {
      const started = Date.now();
      try {
        const r = await fetch(
          `${base}/node_modules/expo-router/entry.bundle?platform=${platform}&${bundleParams}`,
        );
        await r.arrayBuffer();
        log(`[prewarm] ${platform} bundle ready in ${Date.now() - started}ms`);
      } catch (err) {
        log(`[prewarm] ${platform} bundle failed: ${(err as Error).message}`);
      }
    }

    try {
      const started = Date.now();
      const htmlRes = await fetch(`${base}/`);
      const html = await htmlRes.text();
      const match = html.match(/src="(\/[^"]*\.bundle\?[^"]*)"/);
      if (match) {
        const r = await fetch(`${base}${match[1]}`);
        await r.arrayBuffer();
        log(`[prewarm] web bundle ready in ${Date.now() - started}ms`);
      }
    } catch (err) {
      log(`[prewarm] web bundle failed: ${(err as Error).message}`);
    }
  })();
}

function setupErrorHandler(app: express.Application) {
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const error = err as {
      status?: number;
      statusCode?: number;
      message?: string;
    };

    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });
}

(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);

  let devProxy: ReturnType<typeof createProxyMiddleware> | undefined;
  if (process.env.NODE_ENV === "development") {
    const METRO_PORT = process.env.METRO_PORT || "8082";
    const LOADING_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="2"><title>Starting…</title><style>body{margin:0;background:#000;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}</style></head><body><div style="text-align:center"><div style="font-size:2rem;margin-bottom:.5rem">⚡</div><div>Dev server starting…</div><div style="font-size:.75rem;opacity:.5;margin-top:.5rem">Refreshing automatically</div></div></body></html>`;

    // Serve the root path for web browsers by returning Metro's web HTML.
    // Native Expo Go / simulator requests (which carry an expo-platform header)
    // are passed through to the standard manifest/proxy flow below.
    app.get("/", async (req: Request, res: Response, next: NextFunction) => {
      // Native Expo Go requests carry an expo-platform header - let the
      // standard proxy handle those so the existing native flow is unchanged.
      const platform = req.header("expo-platform");
      if (platform === "ios" || platform === "android") {
        return next();
      }

      const replyHtml = (html: string) => {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.setHeader("Cache-Control", "no-store");
        res.send(html);
      };

      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 4000);
        const metroRes = await fetch(`http://127.0.0.1:${METRO_PORT}/`, {
          signal: controller.signal,
        });
        clearTimeout(timer);

        if (!metroRes.ok) {
          return replyHtml(LOADING_HTML);
        }

        const html = await metroRes.text();

        // Serve Metro's web HTML unchanged. The bundle is referenced with a
        // relative path that resolves to this same origin (the standard dev
        // domain) and is proxied to Metro below. Bundles are pre-warmed on
        // startup (see prewarmMetroBundles) so this large response is served
        // from Metro's cache in well under a second.
        replyHtml(html);
      } catch {
        // Metro not ready yet - show a self-refreshing page
        replyHtml(LOADING_HTML);
      }
    });

    devProxy = createProxyMiddleware({
      pathFilter: (pathname: string) =>
        !pathname.startsWith("/api") &&
        pathname !== "/privacy" &&
        pathname !== "/terms",
      target: `http://127.0.0.1:${METRO_PORT}`,
      changeOrigin: true,
      ws: true,
      proxyTimeout: 0,
      timeout: 0,
      on: {
        proxyReq: (proxyReq) => {
          proxyReq.removeHeader('x-forwarded-host');
          proxyReq.removeHeader('x-forwarded-for');
          proxyReq.removeHeader('x-real-ip');
        },
        error: (err, req, res) => {
          const nodeErr = err as NodeJS.ErrnoException;
          const typedReq = req as express.Request;
          console.error(`[devProxy] error proxying ${typedReq.method} ${typedReq.path}: ${nodeErr.code}`);
          if ('writeHead' in (res as object) && typeof (res as import('http').ServerResponse).writeHead === 'function') {
            const sr = res as import('http').ServerResponse;
            if (!sr.headersSent) {
              if (nodeErr.code === 'ECONNREFUSED' || nodeErr.code === 'ECONNRESET') {
                // Metro not ready yet - auto-refresh until it is
                sr.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                sr.end(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="2"><title>Starting…</title><style>body{margin:0;background:#000;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}</style></head><body><div style="text-align:center"><div style="font-size:2rem;margin-bottom:.5rem">⚡</div><div>Dev server starting…</div><div style="font-size:.75rem;opacity:.5;margin-top:.5rem">Refreshing automatically</div></div></body></html>`);
              } else {
                sr.writeHead(502, { 'Content-Type': 'text/plain' });
                sr.end(`Proxy error: ${nodeErr.code} – ${nodeErr.message}`);
              }
            }
          }
        },
      },
    });
    app.use(devProxy);
  }

  await runMigrations();

  configureExpoAndLanding(app);

  const server = await registerRoutes(app);

  setupErrorHandler(app);

  if (devProxy?.upgrade) {
    server.on("upgrade", devProxy.upgrade);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.on("error", (err) => {
    console.error(`Failed to bind primary server on port ${port}:`, err);
  });
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`express server serving on port ${port}`);
    },
  );

  prewarmMetroBundles();

  // The Replit preview pane reaches the backend on port 5000, but the bare dev
  // domain (external port 80) - used by Expo Go and anyone opening the public
  // URL - is mapped to port 8081. Listen there too so every entry point hits the
  // same backend instead of a dead port (which returned HTTP 502).
  if (process.env.NODE_ENV === "development") {
    const SECONDARY_PORT = parseInt(process.env.SECONDARY_PORT || "8081", 10);
    if (SECONDARY_PORT !== port) {
      const secondaryServer = http.createServer(app);
      if (devProxy?.upgrade) {
        secondaryServer.on("upgrade", devProxy.upgrade);
      }
      secondaryServer.on("error", (err) => {
        console.error(
          `Failed to bind secondary server on port ${SECONDARY_PORT}:`,
          err,
        );
      });
      secondaryServer.listen(
        {
          port: SECONDARY_PORT,
          host: "0.0.0.0",
          reusePort: true,
        },
        () => {
          log(`express server also serving on port ${SECONDARY_PORT}`);
        },
      );
    }
  }
})();

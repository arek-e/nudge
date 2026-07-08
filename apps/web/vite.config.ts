import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const workspaceRoot = fileURLToPath(new URL("../..", import.meta.url));
const uiPackageSource = fileURLToPath(new URL("../../packages/ui/src", import.meta.url));
const reactScanBuildStub = fileURLToPath(
  new URL("./src/client/react-scan-build-stub.ts", import.meta.url),
);

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, workspaceRoot, "VITE_");
  const workerProxyTarget = process.env.NUDGE_VITE_PROXY_TARGET;
  const reactScanDevEnabled =
    (command === "serve" && env.VITE_NUDGE_REACT_SCAN !== "0") || env.VITE_NUDGE_REACT_SCAN === "1";
  const workerProxy =
    workerProxyTarget && command === "serve"
      ? {
          changeOrigin: true,
          target: workerProxyTarget,
        }
      : undefined;

  return {
    build: {
      outDir: "dist/client",
      sourcemap: "hidden",
    },
    envDir: workspaceRoot,
    envPrefix: ["VITE_", "CLERK_PUBLISHABLE_KEY"],
    resolve: {
      alias: {
        "@": uiPackageSource,
        ...(reactScanDevEnabled ? {} : { "react-scan": reactScanBuildStub }),
      },
    },
    server: {
      ...(workerProxy
        ? {
            proxy: {
              "/__clerk": workerProxy,
              "/__internal": workerProxy,
              "/api": workerProxy,
              "/mcp": workerProxy,
            },
          }
        : {}),
    },
    plugins: [
      devServiceWorkerCleanupPlugin(),
      tailwindcss(),
      react(),
      VitePWA({
        disable: command === "serve",
        filename: "sw.js",
        includeAssets: [
          "favicon.ico",
          "favicon.svg",
          "offline.html",
          "icons/icon.svg",
          "icons/icon-16.png",
          "icons/icon-32.png",
          "icons/icon-48.png",
          "icons/icon-192.png",
          "icons/icon-512.png",
          "icons/apple-touch-icon.png",
          "icons/nudge-app-icon.svg",
          "icons/nudge-app-icon-16.png",
          "icons/nudge-app-icon-32.png",
          "icons/nudge-app-icon-48.png",
          "icons/nudge-app-icon-192.png",
          "icons/nudge-app-icon-512.png",
          "icons/nudge-apple-touch-icon.png",
        ],
        manifest: false,
        registerType: "autoUpdate",
        workbox: {
          clientsClaim: true,
          globPatterns: ["**/*.{css,html,ico,js,png,svg,webmanifest}"],
          skipWaiting: true,
        },
      }),
    ],
  };
});

function devServiceWorkerCleanupPlugin(): PluginOption {
  const serviceWorkerCleanupScript = `
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    for (const client of clients) {
      client.navigate(client.url);
    }
  })());
});
`;

  const registerCleanupScript = `
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations()
    .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
    .then(() => {
      if ("caches" in window) {
        return caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))));
      }
      return [];
    })
    .then(() => window.location.reload())
    .catch(() => undefined);
}
`;

  return {
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split("?", 1)[0];
        if (pathname === "/sw.js") {
          response.statusCode = 200;
          response.setHeader("content-type", "application/javascript; charset=utf-8");
          response.end(serviceWorkerCleanupScript);
          return;
        }
        if (pathname === "/registerSW.js") {
          response.statusCode = 200;
          response.setHeader("content-type", "application/javascript; charset=utf-8");
          response.end(registerCleanupScript);
          return;
        }
        next();
      });
    },
    enforce: "pre",
    name: "nudge-dev-service-worker-cleanup",
  };
}

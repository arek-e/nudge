import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  build: {
    outDir: "dist/client",
  },
  envDir: fileURLToPath(new URL("../..", import.meta.url)),
  envPrefix: ["VITE_", "CLERK_PUBLISHABLE_KEY"],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../packages/ui/src", import.meta.url)),
    },
  },
  plugins: [
    tailwindcss(),
    react(),
    VitePWA({
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
});

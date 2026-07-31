import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import { VitePWA } from "vite-plugin-pwa";

// Served from GitHub Pages at https://strokirk.github.io/01-mtv/ (project
// page, not a custom domain), so the built asset paths need that repo-name
// prefix. Local dev keeps the default "/".
const base = process.env.GITHUB_PAGES ? "/01-mtv/" : "/";

export default defineConfig({
  base,
  plugins: [
    solid(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        // Default globPatterns only cover js/css/html — explicitly include
        // the theme art (webp) and favicon (svg) so the app is genuinely
        // usable offline after one load, not just its code and data.
        globPatterns: ["**/*.{js,css,html,webp,svg,ico}"],
        // /data/events.json changes independently of app deploys (the CI
        // scrape job commits straight to it) — network-first so a fresh
        // load picks up new data when online, falling back to cache when
        // offline. Everything else (app shell) is precached normally.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith("/data/events.json"),
            handler: "NetworkFirst",
            options: { cacheName: "events-data", networkTimeoutSeconds: 3 },
          },
        ],
      },
      manifest: {
        name: "Medeltidsveckan-programmet",
        short_name: "MTV-programmet",
        description: "Personligt program för Medeltidsveckan — officiellt + inofficiellt, ihopslaget.",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#241019",
        theme_color: "#241019",
        // TODO: no app icons yet — install-to-homescreen will use a browser
        // default. Add 192x192/512x512 PNGs under public/ and reference
        // them here before relying on the installed icon looking right.
        icons: [],
      },
    }),
  ],
});

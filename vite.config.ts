/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json" with { type: "json" };
// @ts-expect-error type error without @types/node package
import process from "node:process";
const host = process.env.TAURI_DEV_HOST;

/** Scripts none of our languages are written in. */
const UNUSED_SUBSETS = /-(cyrillic|cyrillic-ext|greek|greek-ext|vietnamese|hebrew)-\d{3}-/;

/**
 * Trims the Fontsource stylesheets so the unused files are never bundled: every webview we
 * run in reads WOFF2, so the WOFF fallbacks are dropped, and so are subsets for scripts the
 * app never shows. About 2.3 MB less in the installer.
 */
function trimFonts(): Plugin {
  return {
    name: "ghars-trim-fonts",
    enforce: "pre",
    transform(code, id) {
      if (!/[\\/]@fontsource[\\/].*\.css$/.test(id)) return;
      return code
        .replace(/\/\*[^*]*\*\/\s*@font-face\s*\{[^}]*\}\s*/g, (face) => (UNUSED_SUBSETS.test(face) ? "" : face))
        .replace(/,\s*url\([^)]*\.woff\) format\('woff'\)/g, "");
    },
  };
}

// https://vite.dev/config/
export default defineConfig(() => ({
  plugins: [trimFonts(), react()],

  // Shown in Settings → About.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },

  // Two windows: the island (index.html) and settings (settings.html).
  build: {
    rollupOptions: {
      input: { island: "index.html", settings: "settings.html" },
    },
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1437,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1438,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },

  // Unit tests (`pnpm test`). A fixed timezone keeps the date logic the same on every
  // machine; tests that need another one pass it explicitly.
  test: {
    include: ["src/**/*.test.ts"],
    env: { TZ: "UTC" },
  },
}));

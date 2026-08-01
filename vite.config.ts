/// <reference types="vitest/config" />

import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
const visualSmokeMarkerPath = "/__softui_visual_smoke_marker__";

function normalizeWorktreePath(directory: string): string {
  const normalized = resolve(directory).replaceAll("\\", "/").replace(/\/+$/, "");
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

function visualSmokeMarker(): Plugin {
  return {
    name: "softui-visual-smoke-marker",
    apply: "serve",
    configureServer(server) {
      const marker = JSON.stringify({ app: "softui-desktop", root: normalizeWorktreePath(server.config.root) });
      server.middlewares.use((request, response, next) => {
        if (request.method !== "GET" || request.url?.split("?", 1)[0] !== visualSmokeMarkerPath) {
          next();
          return;
        }
        response.statusCode = 200;
        response.setHeader("Content-Type", "application/json");
        response.setHeader("Cache-Control", "no-store");
        response.end(marker);
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react(), visualSmokeMarker()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    clearMocks: true,
    pool: "threads",
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent Vite from obscuring rust errors
  clearScreen: false,
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three")) return "three";
          if (id.includes("node_modules/uplot")) return "uplot";
          if (id.includes("node_modules")) return "vendor";
        },
      },
    },
  },
  // 2. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1421,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));

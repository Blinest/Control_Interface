import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/App.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const fallbackSnapshot = readFileSync(new URL("../src/state/fallbackSnapshot.ts", import.meta.url), "utf8");

assert.match(
  css,
  /\.login-shell\s+\.primary-btn:disabled[\s\S]*background:\s*#[0-9a-fA-F]{6}[\s\S]*color:\s*#[0-9a-fA-F]{6}/,
  "login disabled primary button needs explicit high-contrast background and text colors",
);

assert.match(
  css,
  /\.login-shell\.theme-light\s+\.primary-btn:disabled[\s\S]*background:\s*#[0-9a-fA-F]{6}[\s\S]*color:\s*#[0-9a-fA-F]{6}/,
  "light login disabled primary button needs explicit high-contrast colors",
);

assert.match(
  fallbackSnapshot,
  /localStorage\.getItem\("softui:theme"\)/,
  "initial snapshot should read cached theme before backend bootstrap to avoid startup background flicker",
);

assert.match(
  app,
  /localStorage\.setItem\("softui:theme",\s*nextTheme\)/,
  "theme toggles should persist the selected theme for the next startup frame",
);

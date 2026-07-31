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
  /document\.documentElement\.dataset\.theme/,
  "initial snapshot should preserve the pre-rendered theme before backend bootstrap",
);

assert.match(
  app,
  /writeThemePreference\(snapshot\.authSession\.username,\s*preference\)/,
  "theme toggles should persist the selected theme for the authenticated user",
);

assert.match(
  app,
  /applyTheme\(resolved\)/,
  "theme toggles should update the DOM theme and color scheme immediately",
);

assert.match(
  app,
  /onEmergencyStop=\{\(\) => void submitSystemControl\("emergencyStop"\)\}/,
  "the global emergency stop must call the system-control command immediately",
);

assert.match(
  css,
  /\.login-shell\s+\.login-mark\s*\{[\s\S]*display:\s*grid[\s\S]*place-items:\s*center[\s\S]*background:[\s\S]*border:[\s\S]*border-radius:[\s\S]*width:[\s\S]*height:/,
  "login mark styling must remain owned by the login shell",
);

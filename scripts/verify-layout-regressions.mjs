import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/App.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const sessions = readFileSync(new URL("../src/features/sessions/SessionsPage.tsx", import.meta.url), "utf8");
const sessionsCss = readFileSync(new URL("../src/features/sessions/sessions.css", import.meta.url), "utf8");
const chartsCss = readFileSync(new URL("../src/features/charts/charts.css", import.meta.url), "utf8");
const logs = readFileSync(new URL("../src/features/logs/LogsPage.tsx", import.meta.url), "utf8");
const logsCss = readFileSync(new URL("../src/features/logs/logs.css", import.meta.url), "utf8");
const logFilters = readFileSync(new URL("../src/features/logs/logFilters.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/features/settings/SettingsPage.tsx", import.meta.url), "utf8");
const settingsCss = readFileSync(new URL("../src/features/settings/settings.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/styles/shell.css", import.meta.url), "utf8");
const base = readFileSync(new URL("../src/styles/base.css", import.meta.url), "utf8");

assert.match(shell, /\.global-status-bar[\s\S]*min-width:\s*0/, "global status bar must constrain its flexible content");
assert.match(shell, /\.emergency-stop-button[\s\S]*flex:\s*0\s+0\s+auto/, "emergency stop must remain visible beside status details");
assert.match(shell, /\.app-page-content[\s\S]*overflow:\s*hidden/, "app page must not scroll at shell level");
assert.match(base, /scrollbar-width:\s*none/, "visible scrollbars must be hidden");
assert.doesNotMatch(shell, /\.page-tabs/, "top page tabs must be removed");
assert.match(shell, /grid-template-columns: 224px/, "sidebar must stay fixed width");
assert.doesNotMatch(shell, /@media \(max-width: 1439px\)/, "sidebar must not auto-collapse");
assert.match(css, /\.empty-state[\s\S]*min-height/, "shared empty state must reserve stable space");
assert.match(css, /\.path-value[\s\S]*(overflow-wrap|word-break):\s*anywhere/, "path values must wrap safely");
assert.match(css, /\.primary-btn:disabled[\s\S]*color:/, "primary disabled button needs explicit text color");
assert.match(css, /\.ghost-btn:disabled[\s\S]*color:/, "ghost disabled button needs explicit text color");
assert.match(sessionsCss, /\.recorder-workbench/, "sessions page needs a full-height recorder workbench");
assert.match(sessionsCss, /\.sessions-table-region[\s\S]*overflow:\s*auto/, "session history table must scroll internally");
assert.match(logsCss, /\.logs-toolbar/, "logs page needs a table-style toolbar");
assert.match(logsCss, /\.logs-table-region[\s\S]*overflow:\s*auto/, "logs table must scroll internally");
assert.match(chartsCss, /\.channel-item\s*\{[\s\S]*min-width:\s*0/, "chart channel rows must not clip checkboxes");
assert.match(logs, /TableLayout/, "LogsPage must use table-style page layout");
for (const label of ["warning", "error", "info", "bug"]) {
  assert.match(logFilters, new RegExp(`"${label}"`), `logs page needs ${label} filter`);
}
assert.match(logFilters, /level === "debug"[\s\S]*\? "bug"/, "bug filter should map to debug log level");
assert.match(settingsCss, /\.settings-navigation-tabs/, "settings page needs categorized navigation");
assert.match(settings, /SettingsLayout/, "settings page must use categorized layout");
assert.match(sessions, /RecorderWorkbench/, "SessionsPage must merge recorder and stats into one workbench");
assert.doesNotMatch(
  sessions,
  /\/\*\s*Left: Recording control panel\s*\*\/[\s\S]*\/\*\s*Right: Session history table\s*\*\//,
  "old split comments should be removed after restructure",
);

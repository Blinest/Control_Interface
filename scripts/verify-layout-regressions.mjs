import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/App.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const dataCss = readFileSync(new URL("../src/components/data/data.css", import.meta.url), "utf8");
const sessions = readFileSync(new URL("../src/features/sessions/SessionsPage.tsx", import.meta.url), "utf8");
const sessionsCss = readFileSync(new URL("../src/features/sessions/sessions.css", import.meta.url), "utf8");
const deviceWorkspaceCss = readFileSync(new URL("../src/features/device-workspace/deviceWorkspace.css", import.meta.url), "utf8");
const chartsCss = readFileSync(new URL("../src/features/charts/charts.css", import.meta.url), "utf8");
const logs = readFileSync(new URL("../src/features/logs/LogsPage.tsx", import.meta.url), "utf8");
const logsCss = readFileSync(new URL("../src/features/logs/logs.css", import.meta.url), "utf8");
const logFilters = readFileSync(new URL("../src/features/logs/logFilters.ts", import.meta.url), "utf8");
const settings = readFileSync(new URL("../src/features/settings/SettingsPage.tsx", import.meta.url), "utf8");
const settingsCss = readFileSync(new URL("../src/features/settings/settings.css", import.meta.url), "utf8");
const dashboardCss = readFileSync(new URL("../src/features/dashboard/dashboard.css", import.meta.url), "utf8");
const shell = readFileSync(new URL("../src/styles/shell.css", import.meta.url), "utf8");
const base = readFileSync(new URL("../src/styles/base.css", import.meta.url), "utf8");
const layoutsCss = readFileSync(new URL("../src/styles/layouts.css", import.meta.url), "utf8");

assert.doesNotMatch(css, /\.workspace-control-grid\s+\.panel:nth-child/, "workspace layout must not depend on panel order");
assert.doesNotMatch(css, /display:\s*none\s*!important/, "layout must not hide functional controls with !important");
assert.doesNotMatch(css, /\.playback-bar\s*\{[\s\S]*display:\s*none/, "playback bar must not be globally hidden");
assert.doesNotMatch(css, /grid-template-rows:\s*minmax\([^)]+\)\s*minmax\([^)]+\)\s*minmax\([^)]+\)/, "App.css must not own fixed page row recipes");
for (const selector of ["dashboard-grid", "workspace-table-grid", "charts-grid", "playback-grid", "playback-page-grid", "workspace-overview-grid"]) {
  assert.doesNotMatch(css, new RegExp(`\\.${selector}\\b`), `dead ${selector} layout must be removed from App.css`);
}
assert.doesNotMatch(
  css,
  /\.(?:dashboard|workspace|charts|playback)[\w-]*grid\b[^{,]*:(?:first-child|last-child|nth-child\()/,
  "feature grid layouts must not depend on child order",
);

assert.match(shell, /\.global-status-bar[\s\S]*min-width:\s*0/, "global status bar must constrain its flexible content");
assert.match(shell, /\.emergency-stop-button[\s\S]*flex:\s*0\s+0\s+auto/, "emergency stop must remain visible beside status details");
assert.match(shell, /\.app-content\s*\{[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\)/, "app content must keep a definite content row");
assert.match(shell, /\.app-page-content[\s\S]*overflow:\s*hidden/, "app page must not scroll at shell level");
assert.match(base, /scrollbar-width:\s*none/, "visible scrollbars must be hidden");
assert.match(base, /scrollbar-width:\s*none/, "visible scrollbars must remain hidden");
assert.match(layoutsCss, /\.layout-scroll-region\s*\{[\s\S]*overflow:\s*auto/, "layout scroll regions must be internally scrollable");
assert.match(chartsCss, /\.chart-layout\s+\.charts-sidebar\s*\{[\s\S]*overflow-y:\s*auto/, "chart sidebar must scroll vertically");
assert.match(sessionsCss, /\.sessions-table-region\s*\{[\s\S]*overflow:\s*auto/, "sessions table must scroll internally");
assert.match(logsCss, /\.logs-table-region\s*\{[\s\S]*overflow:\s*auto/, "logs table must scroll internally");
assert.doesNotMatch(css, /\.charts-sidebar\s*\{[^}]*overflow:\s*hidden/, "App.css must not clip chart sidebar");
assert.doesNotMatch(shell, /\.page-tabs/, "top page tabs must be removed");
assert.match(shell, /grid-template-columns: 224px/, "sidebar must stay fixed width");
assert.doesNotMatch(shell, /@media \(max-width: 1439px\)/, "sidebar must not auto-collapse");
assert.match(css, /\.empty-state[\s\S]*min-height/, "shared empty state must reserve stable space");
assert.match(dataCss, /\.empty-state-fill[\s\S]*height:\s*100%/, "fill empty states must occupy their primary region");
assert.match(css, /\.path-value[\s\S]*(overflow-wrap|word-break):\s*anywhere/, "path values must wrap safely");
assert.match(css, /\.primary-btn:disabled[\s\S]*color:/, "primary disabled button needs explicit text color");
assert.match(css, /\.ghost-btn:disabled[\s\S]*color:/, "ghost disabled button needs explicit text color");
assert.match(sessionsCss, /\.recorder-workbench/, "sessions page needs a full-height recorder workbench");
assert.match(sessionsCss, /\.sessions-table-region[\s\S]*overflow:\s*auto/, "session history table must scroll internally");
assert.match(logsCss, /\.logs-toolbar/, "logs page needs a table-style toolbar");
assert.match(logsCss, /\.logs-table-region[\s\S]*overflow:\s*auto/, "logs table must scroll internally");
assert.match(chartsCss, /\.channel-item\s*\{[\s\S]*min-width:\s*0/, "chart channel rows must not clip checkboxes");
assert.doesNotMatch(css, /\.charts-main\s*\{[\s\S]*grid-template-rows:\s*auto\s+auto\s+minmax\(0,\s*1fr\)/, "App.css must not keep the stale chart row recipe that underfills the chart page");
assert.match(chartsCss, /\.charts-subplot-grid\s*\{[\s\S]*grid-template-rows:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/, "charts page must reserve a filled six-subplot grid");
assert.match(chartsCss, /\.chart-subplot-canvas\s*\{[\s\S]*height:\s*100%/, "each chart subplot canvas must fill its panel");
assert.match(logs, /TableLayout/, "LogsPage must use table-style page layout");
for (const label of ["warning", "error", "info", "bug"]) {
  assert.match(logFilters, new RegExp(`"${label}"`), `logs page needs ${label} filter`);
}
assert.match(logFilters, /level === "debug"[\s\S]*\? "bug"/, "bug filter should map to debug log level");
assert.match(settingsCss, /\.settings-navigation-tabs/, "settings page needs categorized navigation");
assert.match(settings, /SettingsLayout/, "settings page must use categorized layout");
assert.match(settingsCss, /\.settings-section\s*\{[\s\S]*max-width:\s*none/, "settings content should fill the main area");
assert.match(dashboardCss, /grid-auto-rows:\s*minmax\(150px,\s*1fr\)/, "dashboard cards should keep a usable minimum height while filling space");
assert.match(dashboardCss, /\.feature-card-grid[\s\S]*align-content:\s*stretch/, "dashboard cards should stretch to fill their grid");
assert.match(dashboardCss, /\.feature-card-grid\s*\{[\s\S]*height:\s*100%/, "dashboard card grid should fill its container");
assert.doesNotMatch(deviceWorkspaceCss, /grid-template-rows:\s*minmax\(92px,\s*108px\)\s*minmax\(360px,\s*1\.45fr\)\s*minmax\(214px,\s*0\.82fr\)/, "device workspace must not restore fixed panel row heights");
for (const selector of ["settings-grid", "logs-page-layout", "sessions-page-layout", "charts-page-layout", "log-filter-bar"]) {
  assert.doesNotMatch(css, new RegExp(`\\.${selector}`), `legacy ${selector} must be removed from App.css`);
}
assert.doesNotMatch(css, /border-radius:\s*8px/, "shared radius must use the design token");
assert.match(sessions, /RecorderWorkbench/, "SessionsPage must merge recorder and stats into one workbench");
assert.doesNotMatch(layoutsCss, /display:\s*none[\s\S]*workbench-context|workbench-context[\s\S]*display:\s*none/);
assert.doesNotMatch(layoutsCss, /chart-channels[\s\S]*display:\s*none/);
assert.doesNotMatch(layoutsCss, /settings-navigation[\s\S]*display:\s*none/);
assert.doesNotMatch(
  sessions,
  /\/\*\s*Left: Recording control panel\s*\*\/[\s\S]*\/\*\s*Right: Session history table\s*\*\//,
  "old split comments should be removed after restructure",
);

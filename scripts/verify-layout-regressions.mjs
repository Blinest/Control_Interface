import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/App.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const sessions = readFileSync(new URL("../src/pages/SessionsPage.tsx", import.meta.url), "utf8");

assert.match(css, /\.actions[\s\S]*overflow:\s*visible/, "top action bar must not clip buttons");
assert.match(css, /\.action-menu/, "top action bar needs a compact secondary action group");
assert.doesNotMatch(css, /@media\s*\(max-width:\s*1600px\)[\s\S]*\.topbar[\s\S]*grid-template-columns:\s*1fr/, "desktop width must keep topbar title and actions on one row");
assert.match(css, /\.empty-state[\s\S]*min-height/, "shared empty state must reserve stable space");
assert.match(css, /\.path-value[\s\S]*(overflow-wrap|word-break):\s*anywhere/, "path values must wrap safely");
assert.match(css, /\.primary-btn:disabled[\s\S]*color:/, "primary disabled button needs explicit text color");
assert.match(css, /\.ghost-btn:disabled[\s\S]*color:/, "ghost disabled button needs explicit text color");
assert.match(css, /\.sessions-workbench/, "sessions page needs a full-height workbench panel");
assert.match(css, /\.logs-page-layout/, "logs page needs a table-style page layout");
assert.match(app, /className="logs-page-layout"/, "LogsPage must use table-style page layout");
assert.match(css, /\.log-filter-bar/, "logs page needs level filter controls");
for (const label of ["warning", "error", "info", "bug"]) {
  assert.match(app, new RegExp(`label:\\s*"${label}"`), `logs page needs ${label} filter`);
}
assert.match(app, /level:\s*"debug"[\s\S]*label:\s*"bug"/, "bug filter should map to debug log level");
assert.match(sessions, /sessions-workbench/, "SessionsPage must merge recorder and stats into one workbench");
assert.doesNotMatch(
  sessions,
  /\/\*\s*Left: Recording control panel\s*\*\/[\s\S]*\/\*\s*Right: Session history table\s*\*\//,
  "old split comments should be removed after restructure",
);

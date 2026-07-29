# SoftUI UI Layout System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current scattered card layout with a stable workstation-style UI layout for the highest-visibility pages.

**Architecture:** Keep the existing React/Tauri behavior and introduce shared layout primitives through CSS plus small JSX restructuring in `App.tsx` and `pages/SessionsPage.tsx`. The first phase fixes layout discipline, empty states, disabled controls, topbar overflow, Sessions, Settings, and Logs without changing backend commands or data contracts.

**Tech Stack:** React 19, TypeScript, Vite, Tauri 2, lucide-react, TanStack Table, existing CSS in `src/App.css`.

## Global Constraints

- Do not change serial protocol behavior, recording/playback commands, authentication behavior, or Rust runtime state contracts.
- Do not redesign brand identity or replace chart/rendering libraries.
- Avoid new dependencies.
- Keep cards at `8px` radius or less.
- Use lucide icons already imported or add lucide icons from `lucide-react`.
- Do not add new corrupted mojibake strings; new visible Chinese text must be valid UTF-8.
- Main page frames should remain stable; scrolling belongs inside table/list/chart regions.
- The project is not currently a git repository, so commit steps are documented but cannot be completed in this workspace.

---

### Task 1: Add Static Layout Regression Checks

**Files:**
- Create: `scripts/verify-layout-regressions.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `npm run test:layout-regressions`
- Consumes: `src/App.css`, `src/App.tsx`, `src/pages/SessionsPage.tsx`

- [ ] **Step 1: Write the failing static regression script**

Create `scripts/verify-layout-regressions.mjs` with these checks:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/App.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");
const sessions = readFileSync(new URL("../src/pages/SessionsPage.tsx", import.meta.url), "utf8");

assert.match(css, /\.actions[\s\S]*overflow:\s*visible/, "top action bar must not clip buttons");
assert.match(css, /\.action-menu/, "top action bar needs a compact secondary action group");
assert.match(css, /\.empty-state[\s\S]*min-height/, "shared empty state must reserve stable space");
assert.match(css, /\.path-value[\s\S]*(overflow-wrap|word-break):\s*anywhere/, "path values must wrap safely");
assert.match(css, /\.primary-btn:disabled[\s\S]*color:/, "primary disabled button needs explicit text color");
assert.match(css, /\.ghost-btn:disabled[\s\S]*color:/, "ghost disabled button needs explicit text color");
assert.match(css, /\.sessions-workbench/, "sessions page needs a full-height workbench panel");
assert.match(css, /\.logs-page-layout/, "logs page needs a table-style page layout");
assert.match(app, /className="logs-page-layout"/, "LogsPage must use table-style page layout");
assert.match(sessions, /sessions-workbench/, "SessionsPage must merge recorder and stats into one workbench");
assert.doesNotMatch(sessions, /\/\*\s*Left: Recording control panel\s*\*\/[\s\S]*\/\*\s*Right: Session history table\s*\*\//, "old split comments should be removed after restructure");
```

- [ ] **Step 2: Add npm script**

Modify `package.json`:

```json
"test:layout-regressions": "node scripts/verify-layout-regressions.mjs"
```

- [ ] **Step 3: Run test to verify it fails before implementation**

Run:

```powershell
npm run test:layout-regressions
```

Expected: FAIL because `.action-menu`, `.sessions-workbench`, `.logs-page-layout`, and shared empty state rules do not exist yet.

---

### Task 2: Add Shared Layout And Control Styles

**Files:**
- Modify: `src/App.css`

**Interfaces:**
- Produces shared classes: `.action-menu`, `.empty-state`, `.empty-state-title`, `.empty-state-copy`, `.text-truncate`, `.text-wrap`, `.path-value`, `.kv-grid`, `.kv-item`, `.panel-fill`, `.layout-scroll`

- [ ] **Step 1: Add reusable text and empty-state classes**

Append near global layout utilities in `src/App.css`:

```css
.text-truncate {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-wrap,
.path-value {
  min-width: 0;
  overflow-wrap: anywhere;
  white-space: normal;
}

.empty-state {
  min-height: 280px;
  display: grid;
  place-items: center;
  padding: 32px 20px;
  text-align: center;
  color: rgba(231, 238, 247, 0.62);
}

.theme-light .empty-state {
  color: rgba(24, 35, 47, 0.62);
}

.empty-state-inner {
  max-width: 460px;
  display: grid;
  gap: 10px;
  justify-items: center;
}

.empty-state-title {
  font-weight: 700;
  color: var(--text);
}

.empty-state-copy {
  margin: 0;
  line-height: 1.55;
}
```

- [ ] **Step 2: Add key-value grid and scroll helpers**

Add:

```css
.kv-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.kv-item {
  min-width: 0;
  display: grid;
  gap: 4px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.theme-light .kv-item {
  background: #f8fbfe;
  border-color: rgba(17, 28, 40, 0.08);
}

.kv-item span {
  color: var(--muted);
  font-size: 0.76rem;
}

.kv-item strong {
  min-width: 0;
  font-size: 0.92rem;
}

.panel-fill {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.layout-scroll {
  min-height: 0;
  overflow: auto;
}
```

- [ ] **Step 3: Add explicit disabled states**

Add:

```css
.primary-btn:disabled,
.ghost-btn:disabled,
.ghost-btn-sm:disabled {
  cursor: not-allowed;
  opacity: 1;
}

.primary-btn:disabled {
  background: #263545;
  border-color: #34465a;
  color: #b7c6d8;
}

.ghost-btn:disabled,
.ghost-btn-sm:disabled {
  background: rgba(38, 53, 69, 0.72);
  border-color: rgba(143, 163, 184, 0.22);
  color: #9fb0c4;
}

.theme-light .primary-btn:disabled {
  background: #d7e1ec;
  border-color: #b8c7d8;
  color: #334155;
}

.theme-light .ghost-btn:disabled,
.theme-light .ghost-btn-sm:disabled {
  background: #e8eef5;
  border-color: #cbd5e1;
  color: #64748b;
}
```

- [ ] **Step 4: Run static layout test**

Run:

```powershell
npm run test:layout-regressions
```

Expected: still FAIL because topbar, sessions, and logs have not been restructured yet.

---

### Task 3: Make The Top Action Bar Overflow-Safe

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes existing callbacks: `toggleTheme`, `fetchSnapshot`, `toggleConnection`, `toggleRecording`, `logoutUser`
- Produces class: `.action-menu`

- [ ] **Step 1: Restructure top action JSX**

In `App.tsx`, inside `<div className="actions">`, group lower-frequency actions:

```tsx
<div className="action-menu" aria-label="secondary actions">
  <button type="button" className="ghost-btn icon-btn" title="保存布局">
    <Save size={16} />
  </button>
  <button type="button" className="ghost-btn account-btn" onClick={logoutUser} title={`退出 ${snapshot.authSession.username}`}>
    <Fingerprint size={16} />
    <span>{snapshot.authSession.username}</span>
  </button>
</div>
```

Keep direct buttons for theme, refresh, connect/disconnect, and recording.

- [ ] **Step 2: Add overflow-safe CSS**

Update `.actions` and add:

```css
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  min-width: 0;
  max-width: min(820px, 62vw);
  overflow: visible;
}

.action-menu {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.icon-btn {
  width: 38px;
  justify-content: center;
  padding-inline: 0;
}

.account-btn {
  max-width: 170px;
}

.account-btn span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 3: Build check**

Run:

```powershell
npm run build
```

Expected: PASS.

---

### Task 4: Rebuild Sessions Page As A Workbench

**Files:**
- Modify: `src/pages/SessionsPage.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes existing props in `SessionsPageProps`
- Produces class names: `.sessions-workbench`, `.sessions-history-panel`, `.sessions-workbench-stats`

- [ ] **Step 1: Merge the recorder and stats panels**

In `SessionsPage.tsx`, replace the two separate sidebar `.panel` elements with one:

```tsx
<aside className="sessions-workbench panel">
  <div className="panel-head">...</div>
  <div className="sessions-recorder-status">...</div>
  <div className="sessions-recorder-actions">...</div>
  <div className="sessions-workbench-stats">
    <div className="kv-item">
      <span>总会话数</span>
      <strong>{sessions.length}</strong>
    </div>
    <div className="kv-item">
      <span>当前会话</span>
      <strong className="text-truncate" title={recorderStatus.sessionName || "无"}>
        {recorderStatus.sessionName || "无"}
      </strong>
    </div>
    <div className="kv-item">
      <span>保存方式</span>
      <strong>停止录制后入库</strong>
    </div>
  </div>
</aside>
```

Use valid Chinese text for any newly added labels.

- [ ] **Step 2: Make history a full-height panel**

Wrap the right panel:

```tsx
<main className="sessions-main">
  <div className="panel wide sessions-history-panel panel-fill">
    ...
  </div>
</main>
```

Use `.layout-scroll` on the table wrapper or existing `.sessions-table-wrap`.

- [ ] **Step 3: Replace one-line empty state**

Replace `.sessions-empty` content with:

```tsx
<div className="empty-state sessions-empty">
  <div className="empty-state-inner">
    <Database size={28} />
    <div className="empty-state-title">暂无录制会话</div>
    <p className="empty-state-copy">在左侧录制工作台开始录制，停止后会话会出现在这里，可用于回放、导出和重命名。</p>
  </div>
</div>
```

- [ ] **Step 4: Update sessions CSS**

Replace sessions layout rules:

```css
.sessions-page-layout {
  display: grid;
  grid-template-columns: minmax(300px, 340px) minmax(0, 1fr);
  gap: 14px;
  min-height: 0;
  height: 100%;
  overflow: hidden;
  align-items: stretch;
}

.sessions-workbench {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sessions-workbench-stats {
  margin-top: auto;
  display: grid;
  gap: 8px;
}

.sessions-main {
  min-height: 0;
  overflow: hidden;
}

.sessions-history-panel {
  min-height: 0;
}

.sessions-table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
}
```

- [ ] **Step 5: Run checks**

Run:

```powershell
npm run test:layout-regressions
npm run build
```

Expected: layout regression still may fail if logs are not complete; build must PASS.

---

### Task 5: Stabilize Settings Layout

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes `snapshot.settings`, `snapshot.authSession`, `users`, account handlers, diagnostics handlers, migration handlers
- Produces improved `.settings-grid`, `.settings-config-grid`, `.account-summary-grid`

- [ ] **Step 1: Change application config markup**

In `SettingsPage`, replace the six `.stack-item` config rows with:

```tsx
<div className="settings-config-grid kv-grid">
  <div className="kv-item"><span>主题</span><strong>{snapshot.settings.theme}</strong></div>
  <div className="kv-item"><span>界面密度</span><strong>{snapshot.settings.workspaceDensity}</strong></div>
  <div className="kv-item"><span>自动重连</span><strong>{snapshot.settings.autoReconnect ? "启用" : "关闭"}</strong></div>
  <div className="kv-item"><span>诊断级别</span><strong>{snapshot.settings.diagnosticsLevel}</strong></div>
  <div className="kv-item path-item"><span>数据目录</span><strong className="path-value" title={snapshot.settings.dataDirectory}>{snapshot.settings.dataDirectory}</strong></div>
  <div className="kv-item path-item"><span>模型目录</span><strong className="path-value" title={snapshot.settings.modelDirectory}>{snapshot.settings.modelDirectory}</strong></div>
</div>
```

- [ ] **Step 2: Change account summary markup**

Replace the three top account `.stack-item`s with a `kv-grid`:

```tsx
<div className="kv-grid account-summary-grid">
  <div className="kv-item"><span>当前用户</span><strong>{snapshot.authSession.authenticated ? snapshot.authSession.username : "未登录"}</strong></div>
  <div className="kv-item"><span>角色</span><strong>{snapshot.authSession.role}</strong></div>
  <div className="kv-item"><span>用户数量</span><strong>{users.length || "无权限查看"}</strong></div>
</div>
```

- [ ] **Step 3: Make settings grid stack secondary sections safely**

Replace final fit rules for `.settings-grid` with:

```css
.settings-grid {
  height: 100%;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr) auto;
  align-content: stretch;
  align-items: stretch;
  overflow: hidden;
}

.settings-grid .panel {
  min-height: 0;
}

.settings-grid .panel:nth-child(1),
.settings-grid .panel:nth-child(2),
.settings-grid .panel:nth-child(4) {
  grid-column: 1;
}

.settings-grid .panel:nth-child(3) {
  grid-column: 1;
  height: auto;
}

.settings-config-grid {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.settings-config-grid .path-item {
  grid-column: span 2;
}
```

Add exact responsive rules:

```css
@media (max-width: 1320px) {
  .settings-config-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .settings-config-grid .path-item {
    grid-column: span 1;
  }
}

@media (max-width: 760px) {
  .settings-config-grid,
  .account-summary-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 4: Run checks**

Run:

```powershell
npm run build
```

Expected: PASS.

---

### Task 6: Convert Logs Page To A Full-Height Table Layout

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes `snapshot.logs`
- Produces class: `.logs-page-layout`

- [ ] **Step 1: Restructure LogsPage**

Replace the current single `Panel` with:

```tsx
function LogsPage({ snapshot }: { snapshot: RuntimeSnapshot }) {
  return (
    <div className="logs-page-layout panel panel-fill">
      <div className="panel-head">
        <div>
          <div className="panel-kicker">diagnostics</div>
          <h2>日志</h2>
        </div>
        <div className="kv-grid logs-summary">
          <div className="kv-item"><span>总数</span><strong>{snapshot.logs.length}</strong></div>
          <div className="kv-item"><span>错误</span><strong>{snapshot.logs.filter((entry) => entry.level === "error").length}</strong></div>
        </div>
      </div>
      {snapshot.logs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-inner">
            <Logs size={28} />
            <div className="empty-state-title">暂无日志</div>
            <p className="empty-state-copy">运行状态、协议错误和审计事件会显示在这里。</p>
          </div>
        </div>
      ) : (
        <div className="log-list layout-scroll">
          {snapshot.logs.map((entry) => (
            <div className="log-row" key={entry.id} title={`${isoShort(entry.timestampMs)} ${entry.scope} ${entry.message}`}>
              <Badge tone={toneForLevel(entry.level)}>{entry.level.toUpperCase()}</Badge>
              <span className="log-time">{isoShort(entry.timestampMs)}</span>
              <span className="log-scope text-truncate">{entry.scope}</span>
              <span className="log-message text-truncate">{entry.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add logs layout CSS**

Add:

```css
.logs-page-layout {
  height: 100%;
  min-height: 0;
}

.logs-summary {
  width: min(320px, 34vw);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.logs-page-layout .log-list {
  flex: 1;
  min-height: 0;
}
```

- [ ] **Step 3: Run checks**

Run:

```powershell
npm run test:layout-regressions
npm run build
```

Expected: PASS.

---

### Task 7: Visual Verification And Runtime Check

**Files:**
- No code changes expected
- Generate screenshots under `D:\APP\ControlUI\`

**Interfaces:**
- Consumes local app at `D:\APP\ControlUI\softui-desktop`

- [ ] **Step 1: Run all frontend checks**

Run:

```powershell
npm run test:ui-regressions
npm run test:layout-regressions
npm run build
```

Expected: all PASS.

- [ ] **Step 2: Stop old app process**

Run:

```powershell
Stop-Process -Name softui-desktop -Force -ErrorAction SilentlyContinue
```

Expected: no running old `softui-desktop` process.

- [ ] **Step 3: Start current app**

Run:

```powershell
Start-Process -FilePath "cmd.exe" -ArgumentList @('/c','set SOFTUI_DATA_DIR=D:\APP\ControlUI\data&& npm.cmd run tauri dev') -WorkingDirectory "D:\APP\ControlUI\softui-desktop" -WindowStyle Hidden
```

Expected: Tauri window titled `SoftUI` opens.

- [ ] **Step 4: Check runtime responsiveness**

Run:

```powershell
Start-Sleep -Seconds 20
Get-Process -Name softui-desktop -ErrorAction SilentlyContinue | Select-Object Id,ProcessName,Responding,MainWindowTitle
```

Expected: `Responding` is `True`.

- [ ] **Step 5: Capture desktop screenshots**

Capture at least:

- `D:\APP\ControlUI\layout-sessions-after.png`
- `D:\APP\ControlUI\layout-settings-after.png`
- `D:\APP\ControlUI\layout-logs-after.png`

Expected visual results:

- Sessions left side is one full-height workbench, not two floating cards.
- Sessions empty/history panel fills the page body.
- Settings no longer clips the diagnostics section.
- Top action bar does not clip buttons.
- Disabled controls remain readable in light theme.

---

## Self-Review

Spec coverage:

- Top action bar overflow: Task 3.
- Sessions scattered cards and empty space: Task 4.
- Settings compression and clipping: Task 5.
- Logs table layout: Task 6.
- Shared empty state, disabled controls, long text: Task 2.
- Verification: Task 7.

Placeholder scan:

- No incomplete implementation placeholders are used.

Type consistency:

- React prop contracts remain unchanged.
- New CSS class names are defined before use.
- New npm script name is `test:layout-regressions`.

Git note:

- Commit steps are omitted from task bodies because `D:\APP\ControlUI\softui-desktop` is not a git repository.

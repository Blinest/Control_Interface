# UI Cleanup Responsive And Desktop Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除旧页面和重复 CSS，完成小窗口响应、视觉回归、性能检查和 Tauri 桌面验收。

**Architecture:** 先把剩余控制器状态从 `App.tsx` 拆到 hooks，再通过静态回归脚本保证旧选择器不会回流。增加仅测试环境可用的 fixture 入口和 Playwright 截图矩阵，最后用真实 Tauri 进程验证启动、主题、轮询、录制和页面切换响应性。

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Playwright, Tauri 2, PowerShell runtime checks, existing Rust tests.

## Global Constraints

- 删除旧实现只能在替代页面已路由、测试通过后进行。
- 小窗口不能隐藏急停、当前设备或安全状态。
- 标准桌面为宽度不小于 `1440`，紧凑桌面为 `1120-1439`，小窗口为小于 `1120`。
- 页面框架固定，只有列表、表格、日志、图表和表单内容区内部滚动。
- 主题与窗口变化不得重建 uPlot 或 Three.js 实例。
- 视觉矩阵覆盖浅色/深色、`1600x900`、`1366x768`、`1100x700`。
- Tauri 运行数据继续存放在 `D:\APP\ControlUI`。
- 不杀死无法确认归属的进程，不覆盖用户数据或配置。

---

## File Structure

```text
src/
  app/useAppController.ts
  app/App.tsx
  test/fixtures/
    fixtureSnapshot.ts
    VisualFixtureApp.tsx
scripts/
  verify-layout-regressions.mjs
  verify-ui-regressions.mjs
  verify-source-boundaries.mjs
tests/visual/
  app-shell.spec.ts
playwright.config.ts
```

### Task 1: Extract The Application Controller And Shrink App.tsx

**Files:**
- Create: `src/app/useAppController.ts`
- Create: `src/app/useAppController.test.tsx`
- Create: `src/app/App.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `AppController`, `useAppController(client?: TauriClient)`
- Consumes: `TauriClient`, runtime types and all page callback contracts

- [ ] **Step 1: Write a failing controller polling test**

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useAppController } from "./useAppController";
import { fixtureSnapshot } from "../test/fixtures/fixtureSnapshot";

const createFakeTauriClient = (): TauriClient => ({
  bootstrap: vi.fn().mockResolvedValue(fixtureSnapshot),
  tick: vi.fn().mockResolvedValue(fixtureSnapshot),
  submitSystemControl: vi.fn().mockResolvedValue(fixtureSnapshot),
  sendMotorCommand: vi.fn().mockResolvedValue(fixtureSnapshot),
  invoke: vi.fn().mockResolvedValue([]),
});

it("coalesces snapshot polling into one controller", async () => {
  vi.useFakeTimers();
  const client = createFakeTauriClient();
  renderHook(() => useAppController(client));
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(client.tick).toHaveBeenCalledTimes(3);
  vi.useRealTimers();
});
```

- [ ] **Step 2: Run the test to verify failure**

```powershell
npm.cmd run test:unit -- src/app/useAppController.test.tsx
```

Expected: FAIL because the hook is missing.

- [ ] **Step 3: Define the controller interface**

```ts
export interface AppController {
  snapshot: RuntimeSnapshot;
  currentDeviceId: string;
  serialPorts: SerialPortDescriptor[];
  connectedDevices: DeviceConnectionRecord[];
  deviceStatuses: Record<string, DeviceRuntimeStatusView>;
  recorderStatus: RecorderStatus;
  sessions: SessionInfo[];
  playbackStatus: PlaybackStatus | null;
  users: UserAccount[];
  selectDevice(deviceId: string): void;
  refresh(): Promise<void>;
  actions: {
    auth: {
      login(username: string, password: string): Promise<void>;
      changeOwnPassword(oldPassword: string, newPassword: string): Promise<void>;
      logout(): Promise<void>;
      createUser(username: string, password: string, role: Role): Promise<void>;
      resetUserPassword(username: string, newPassword: string): Promise<void>;
      setUserDisabled(username: string, disabled: boolean): Promise<void>;
    };
    connection: {
      connect(request: ConnectDeviceRequest): Promise<void>;
      disconnect(deviceId: string): Promise<void>;
      refreshPorts(): Promise<void>;
      saveProfile(profile: ConnectionProfile): Promise<void>;
      deleteProfile(id: string): Promise<void>;
    };
    recording: {
      toggle(): Promise<void>;
      pause(): Promise<void>;
      resume(): Promise<void>;
      deleteSession(id: string): Promise<void>;
      renameSession(id: string, name: string): Promise<void>;
      exportCsv(id: string): Promise<void>;
    };
    playback: {
      load(id: string): Promise<void>;
      playPause(): Promise<void>;
      stop(): Promise<void>;
      seek(ms: number): Promise<void>;
      setSpeed(speed: number): Promise<void>;
    };
    control: {
      emergencyStop(): Promise<void>;
      recover(): Promise<void>;
      setSystem(action: "enable" | "disable"): Promise<void>;
      sendMotor(command: MotorCommandDraft): Promise<void>;
      submitWorkspace(command: WorkspaceCommand, payload?: WorkspaceCommandPayload): Promise<void>;
    };
    settings: {
      setTheme(preference: ThemePreference): Promise<void>;
      exportDiagnostics(): Promise<void>;
      setMigrationSource(value: string): void;
      previewMigration(): Promise<void>;
      runMigration(): Promise<void>;
    };
  };
}
```

Move every existing callback into the matching action group above. Keep one controller effect per polling cadence and clear every interval on unmount.

- [ ] **Step 4: Reduce App to composition**

`src/app/App.tsx` owns only authentication branch, `AppShell`, `AppRouter`, dialog hosts and controller wiring. Root `src/App.tsx` becomes a compatibility re-export:

```ts
export { default } from "./app/App";
```

- [ ] **Step 5: Run tests and build**

```powershell
npm.cmd run test:unit -- src/app/useAppController.test.tsx
npm.cmd run build
```

Expected: both commands exit `0`.

- [ ] **Step 6: Commit**

```powershell
git add src/app src/App.tsx src/main.tsx
git commit -m "refactor: isolate application controller from UI"
```

### Task 2: Delete Legacy CSS And Enforce Source Boundaries

**Files:**
- Create: `scripts/verify-source-boundaries.mjs`
- Modify: `package.json`
- Modify: `src/App.css`
- Modify: `scripts/verify-layout-regressions.mjs`
- Modify: `scripts/verify-ui-regressions.mjs`

**Interfaces:**
- Produces: `npm run test:source-boundaries`
- Enforces: no direct Tauri invoke in components/features/layouts; no old page variants or duplicate shell selectors

- [ ] **Step 1: Write the failing boundary script**

Create `scripts/verify-source-boundaries.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const files = execFileSync("rg", ["--files", "src"], { encoding: "utf8" })
  .trim().split(/\r?\n/).filter((file) => /\.(ts|tsx)$/.test(file));

for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (/^src[\\/](components|features|layouts)[\\/]/.test(file)) {
    assert.doesNotMatch(source, /from ["']@tauri-apps\/api\/core["']/, `${file} must use tauriClient`);
  }
}

const app = readFileSync("src/App.tsx", "utf8");
assert.doesNotMatch(app, /function (WorkspacePage|LogsPageV\d|SettingsPageV\d)/, "legacy inline pages must be removed");
console.log("source boundary checks passed");
```

Add:

```json
"test:source-boundaries": "node scripts/verify-source-boundaries.mjs"
```

- [ ] **Step 2: Run the script to verify failure**

```powershell
npm.cmd run test:source-boundaries
```

Expected: FAIL until direct invokes and inline legacy page definitions are removed.

- [ ] **Step 3: Remove obsolete CSS by ownership**

Delete old shell, page-grid, duplicated media queries, `.panel:nth-child()` settings rules, old session layout, old log page variants and repair-pass sections from `App.css`. Move any still-used component rules into their feature CSS file. Keep `App.css` as a compatibility import file only:

```css
@import "./styles/tokens.css";
@import "./styles/base.css";
@import "./styles/shell.css";
@import "./styles/layouts.css";
@import "./styles/utilities.css";
```

- [ ] **Step 4: Update static regression assertions**

Assert:

- exactly one shell grid definition;
- breakpoints `1439px` and `1119px` exist;
- no `@media (max-width: 1600px)` topbar stack rule;
- no `.settings-grid .panel:nth-child` selectors;
- no hidden overflow on table/log/chart scroll regions;
- disabled buttons have explicit color tokens.

- [ ] **Step 5: Run tests and build**

```powershell
npm.cmd run test:source-boundaries
npm.cmd run test:ui-regressions
npm.cmd run test:layout-regressions
npm.cmd run build
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit**

```powershell
git add src/App.css src/styles src/features scripts package.json
git commit -m "refactor: remove legacy UI and duplicate CSS"
```

### Task 3: Add Responsive And Overflow Regression Tests

**Files:**
- Create: `src/app/responsive-contract.test.ts`
- Modify: `src/styles/shell.css`
- Modify: `src/styles/layouts.css`
- Modify: feature CSS files

**Interfaces:**
- Enforces three viewport modes and fixed-format element stability

- [ ] **Step 1: Write CSS contract tests**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const shell = readFileSync(new URL("../styles/shell.css", import.meta.url), "utf8");
const layouts = readFileSync(new URL("../styles/layouts.css", import.meta.url), "utf8");

describe("responsive contract", () => {
  it("defines compact and small window breakpoints", () => {
    expect(shell).toContain("@media (max-width: 1439px)");
    expect(layouts).toContain("@media (max-width: 1119px)");
  });

  it("keeps content regions shrinkable and internally scrollable", () => {
    expect(layouts).toMatch(/\.layout-scroll-region[\s\S]*min-height:\s*0[\s\S]*overflow:\s*auto/);
  });
});
```

- [ ] **Step 2: Run the test to verify current failures**

```powershell
npm.cmd run test:unit -- src/app/responsive-contract.test.ts
```

Expected: FAIL for any missing breakpoint or scroll contract.

- [ ] **Step 3: Implement compact and small-window behavior**

At `<1440`, collapse sidebar labels but preserve tooltip and keyboard focus. At `<1120`, make device context, chart channels and settings navigation accessible through explicit drawer buttons; keep top status and emergency stop fixed. Tabs use `overflow-x: auto`; forms become one column; card grid becomes two columns then one without changing card order.

- [ ] **Step 4: Add text containment rules**

```css
.text-truncate { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.text-wrap, .path-value { min-width: 0; overflow-wrap: anywhere; white-space: normal; }
.stable-icon-button { inline-size: 36px; block-size: 36px; flex: 0 0 36px; }
.stable-tab { min-block-size: 38px; white-space: nowrap; }
```

- [ ] **Step 5: Run tests and build**

```powershell
npm.cmd run test:unit -- src/app/responsive-contract.test.ts
npm.cmd run test:layout-regressions
npm.cmd run build
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit**

```powershell
git add src/styles src/features src/app/responsive-contract.test.ts scripts
git commit -m "feat: enforce responsive workstation layouts"
```

### Task 4: Add Reproducible Visual Regression Screenshots

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/test/fixtures/fixtureSnapshot.ts`
- Create: `src/test/fixtures/VisualFixtureApp.tsx`
- Modify: `src/main.tsx`
- Create: `playwright.config.ts`
- Create: `tests/visual/app-shell.spec.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run test:visual`
- Produces fixture URL only when `VITE_VISUAL_TEST=1`

- [ ] **Step 1: Install Playwright test tooling**

```powershell
npm.cmd install -D @playwright/test
npx.cmd playwright install chromium
```

Add scripts:

```json
"dev:visual": "vite --port 1422 --strictPort",
"test:visual": "playwright test"
```

- [ ] **Step 2: Create a deterministic fixture app**

`fixtureSnapshot.ts` exports complete `RuntimeSnapshot` fixtures for normal, empty, emergency and long-text states. `VisualFixtureApp` accepts query parameters `theme`, `page`, `state`, and renders real application shell/page components with no Tauri calls.

In `main.tsx`:

```tsx
const VisualFixtureApp = import.meta.env.VITE_VISUAL_TEST === "1"
  ? React.lazy(() => import("./test/fixtures/VisualFixtureApp"))
  : null;

const root = VisualFixtureApp ? <VisualFixtureApp /> : <App />;
```

Set `VITE_VISUAL_TEST=1` in the Playwright web server command, not in production `.env` files.

- [ ] **Step 3: Configure screenshot matrix**

Create `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/visual",
  use: { baseURL: "http://127.0.0.1:1422", screenshot: "only-on-failure" },
  webServer: {
    command: "set VITE_VISUAL_TEST=1&& npm.cmd run dev:visual",
    url: "http://127.0.0.1:1422",
    reuseExistingServer: false,
  },
});
```

- [ ] **Step 4: Write visual tests**

```ts
import { expect, test } from "@playwright/test";

const viewports = [
  { name: "wide", width: 1600, height: 900 },
  { name: "compact", width: 1366, height: 768 },
  { name: "small", width: 1100, height: 700 },
];

for (const theme of ["light", "dark"]) {
  for (const viewport of viewports) {
    test(`${theme} dashboard ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(`/?theme=${theme}&page=dashboard&state=normal`);
      await expect(page.locator(".app-shell")).toHaveScreenshot(`${theme}-dashboard-${viewport.name}.png`, { animations: "disabled" });
    });
  }
}
```

Add page/state cases for login, workspace monitor, manual control, automatic control, charts, sessions empty, logs long-text, settings paths and emergency.

- [ ] **Step 5: Run and inspect visual tests**

```powershell
npm.cmd run test:visual -- --update-snapshots
npm.cmd run test:visual
```

Expected: first command writes reviewed baselines; second command passes without pixel differences. Inspect every generated image before committing.

- [ ] **Step 6: Ignore transient Playwright output and commit baselines**

Add `test-results/` and `playwright-report/` to `.gitignore`; keep `tests/visual/app-shell.spec.ts-snapshots/` tracked.

```powershell
git add package.json package-lock.json playwright.config.ts src/test/fixtures src/main.tsx tests/visual .gitignore
git commit -m "test: add cross-theme visual regression matrix"
```

### Task 5: Run Tauri Desktop Performance And Safety Acceptance

**Files:**
- Create: `docs/verification/ui-workstation-acceptance.md`
- Production code is not part of this task. Any measured failure opens a separate TDD fix task before acceptance is recorded.

**Interfaces:**
- Verifies the real executable, Rust backend and `D:\APP\ControlUI` runtime directory

- [ ] **Step 1: Run all automated checks fresh**

```powershell
npm.cmd run test:unit
npm.cmd run test:source-boundaries
npm.cmd run test:ui-regressions
npm.cmd run test:layout-regressions
npm.cmd run test:visual
npm.cmd run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: every command exits `0`; record counts and durations in the acceptance document.

- [ ] **Step 2: Verify port and process ownership before launch**

```powershell
$listener = Get-NetTCPConnection -LocalPort 1421 -State Listen -ErrorAction SilentlyContinue
if ($listener) { Get-Process -Id $listener.OwningProcess | Select-Object Id,ProcessName,Path }
```

If the port belongs to an unrelated process, stop and use a separate verified port configuration; do not terminate it.

- [ ] **Step 3: Start Tauri without a flashing console**

```powershell
$env:SOFTUI_DATA_DIR = 'D:\APP\ControlUI'
Start-Process -FilePath 'npm.cmd' -ArgumentList @('run','tauri','dev') -WorkingDirectory 'D:\APP\ControlUI\softui-desktop' -WindowStyle Hidden
```

Wait for the SoftUI window by polling in intervals no longer than 10 seconds; do not open multiple dev instances.

- [ ] **Step 4: Execute the manual desktop matrix**

Record pass/fail for:

- launch in system theme without flash;
- login and per-user theme persistence;
- switch light/dark on every page;
- sidebar compact mode and `1100x700` minimum window;
- connect simulator and a real serial device when available;
- select current device while another remains monitored;
- immediate emergency stop and confirmed recovery;
- manual and automatic controls disabled for wrong/unsafe state;
- start, pause, resume and stop recording;
- playback and session export;
- logs four filters and detail drawer;
- long paths and empty states;
- 15 minutes of snapshot polling with window `Responding=True` and no repeated restart.

- [ ] **Step 5: Capture responsiveness evidence**

```powershell
Get-Process | Where-Object { $_.MainWindowTitle -eq 'SoftUI' } | Select-Object Id,ProcessName,Responding,CPU,WorkingSet64,MainWindowTitle
```

Capture at start, after theme switching, after recording, and after 15 minutes. Record values in `docs/verification/ui-workstation-acceptance.md`.

- [ ] **Step 6: Stop only the verified development process**

Resolve the exact SoftUI process, require one matching process, verify its `Path` is inside `D:\APP\ControlUI\softui-desktop\src-tauri\target`, then stop that exact ID:

```powershell
$softUiTargetRoot = [System.IO.Path]::GetFullPath('D:\APP\ControlUI\softui-desktop\src-tauri\target')
$softUiProcesses = @(Get-Process | Where-Object {
  $_.MainWindowTitle -eq 'SoftUI' -and
  $_.Path -and
  [System.IO.Path]::GetFullPath($_.Path).StartsWith($softUiTargetRoot, [System.StringComparison]::OrdinalIgnoreCase)
})
if ($softUiProcesses.Count -ne 1) { throw "Expected one verified SoftUI process, found $($softUiProcesses.Count)" }
Stop-Process -Id $softUiProcesses[0].Id
```

Never use a wildcard or terminate unrelated Node/Tauri processes.

- [ ] **Step 7: Commit acceptance evidence**

```powershell
git add docs/verification/ui-workstation-acceptance.md
git commit -m "docs: record workstation UI acceptance results"
```

## Final Verification

Run fresh after all fixes and acceptance edits:

```powershell
npm.cmd run test:unit
npm.cmd run test:source-boundaries
npm.cmd run test:ui-regressions
npm.cmd run test:layout-regressions
npm.cmd run test:visual
npm.cmd run build
cargo test --manifest-path src-tauri/Cargo.toml
git status --short --branch
```

Expected: every test/build command exits `0`; the branch is clean except for intentional commits and is ready for review.

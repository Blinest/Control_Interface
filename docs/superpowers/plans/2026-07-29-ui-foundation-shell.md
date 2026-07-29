# SoftUI UI Foundation And App Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立可测试的双主题设计系统、共享页面模板和稳定应用壳，并让现有页面在新壳中继续运行。

**Architecture:** 先引入 Vitest/jsdom 测试基线，再把主题启动、语义令牌、导航、全局状态栏、页面标签、底部状态栏和页面模板拆到独立模块。阶段结束时保留现有业务页面与命令回调，只替换外围结构，降低迁移风险。

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Tauri 2, Vitest, jsdom, Testing Library, lucide-react, CSS custom properties.

## Global Constraints

- 首次启动跟随 Windows 系统主题；用户手动选择后按用户持久化。
- 登录页渲染前必须应用主题，不允许启动闪白或无原因切换背景。
- 主题切换不得改变尺寸、字重和布局，不对大面积背景执行切换动画。
- 普通文字对比度至少 `4.5:1`；大文字、图标和关键状态图形至少 `3:1`。
- 禁用态必须显式定义背景、边框和文字色，不能只使用 `opacity`。
- 卡片圆角不超过 `8px`；不引入装饰光斑、营销式大标题或漂浮页面区块。
- 本阶段不修改 Rust 控制、协议、存储格式或 Tauri 命令签名。

---

## File Structure

```text
src/
  app/
    AppRouter.tsx              # 路由与旧页面适配
    AppShell.tsx               # 四层全局框架
    navigation.ts              # 单一导航配置
  components/layout/
    SidebarNav.tsx
    GlobalStatusBar.tsx
    PageTabs.tsx
    AppFooter.tsx
  layouts/
    DashboardLayout.tsx
    WorkbenchLayout.tsx
    ChartLayout.tsx
    TableLayout.tsx
    SettingsLayout.tsx
  state/themeStore.ts          # 启动主题、系统主题和用户覆盖
  styles/
    tokens.css
    base.css
    shell.css
    layouts.css
    utilities.css
  test/setup.ts
```

### Task 1: Install The Frontend Test Harness

**Files:**
- Modify: `package.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/smoke.test.tsx`
- Create: `src/state/fallbackSnapshot.ts`
- Create: `src/test/fixtures/fixtureSnapshot.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `npm run test:unit` and `npm run test:unit:watch`
- Consumes: existing Vite React plugin and TypeScript config

- [ ] **Step 1: Add the test dependencies and scripts**

Run:

```powershell
npm.cmd install -D vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Add to `package.json` scripts:

```json
"test:unit": "vitest run",
"test:unit:watch": "vitest"
```

- [ ] **Step 2: Configure Vitest**

Extend `vite.config.ts` with a typed test block:

```ts
/// <reference types="vitest/config" />

export default defineConfig(async () => ({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: true,
    clearMocks: true,
  },
  // keep the existing Tauri server block unchanged
}));
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }),
});
```

- [ ] **Step 3: Write and run the smoke test**

Create `src/test/smoke.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("frontend test harness", () => {
  it("renders React content", () => {
    render(<button type="button">连接设备</button>);
    expect(screen.getByRole("button", { name: "连接设备" })).toBeVisible();
  });
});
```

Run:

```powershell
npm.cmd run test:unit
```

Expected: one test passes and the process exits with code `0`.

- [ ] **Step 4: Extract the deterministic fallback snapshot fixture**

Move the complete existing function at `src/App.tsx:238-395` into `src/state/fallbackSnapshot.ts`. Add `import type { RuntimeSnapshot } from "../softuiTypes";` and change its declaration from `function makeFallbackSnapshot()` to `export function makeFallbackSnapshot()`; do not change any returned fixture values.

Create `src/test/fixtures/fixtureSnapshot.ts`:

```ts
import { makeFallbackSnapshot } from "../../state/fallbackSnapshot";

export const fixtureSnapshot = makeFallbackSnapshot();
```

Import `makeFallbackSnapshot` back into `App.tsx`. Verify the fallback object has one definition in the repository:

```powershell
rg -n "function makeFallbackSnapshot" src
```

Expected: exactly one match in `src/state/fallbackSnapshot.ts`.

- [ ] **Step 5: Verify the production build**

Run:

```powershell
npm.cmd run build
```

Expected: TypeScript and Vite complete with exit code `0`.

- [ ] **Step 6: Commit the harness**

```powershell
git add package.json package-lock.json vite.config.ts src/test src/state/fallbackSnapshot.ts src/App.tsx
git commit -m "test: add frontend component test harness"
```

### Task 2: Implement Theme Bootstrap And Semantic Tokens

**Files:**
- Create: `src/state/themeStore.ts`
- Create: `src/state/themeStore.test.ts`
- Create: `src/styles/tokens.css`
- Create: `src/styles/base.css`
- Modify: `index.html`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `ThemePreference`, `resolveTheme`, `readThemePreference`, `writeThemePreference`, `applyTheme`
- Produces DOM contract: `<html data-theme="light|dark">`
- Consumes: `ThemeMode` from `src/softuiTypes.ts`

- [ ] **Step 1: Write failing theme-store tests**

Create `src/state/themeStore.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyTheme, readThemePreference, resolveTheme, writeThemePreference } from "./themeStore";

describe("themeStore", () => {
  beforeEach(() => localStorage.clear());

  it("uses the system theme before a user override exists", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("stores the choice per authenticated user", () => {
    writeThemePreference("admin", "dark");
    expect(readThemePreference("admin")).toBe("dark");
    expect(readThemePreference("operator")).toBe("system");
  });

  it("applies the theme without changing component geometry", () => {
    const root = document.documentElement;
    applyTheme("light", root);
    expect(root.dataset.theme).toBe("light");
    expect(root.style.colorScheme).toBe("light");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
npm.cmd run test:unit -- src/state/themeStore.test.ts
```

Expected: FAIL because `themeStore.ts` does not exist.

- [ ] **Step 3: Implement the theme store**

Create `src/state/themeStore.ts`:

```ts
import type { ThemeMode } from "../softuiTypes";

export type ThemePreference = ThemeMode | "system";

const keyFor = (username: string) => `softui:theme:${username || "anonymous"}`;

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ThemeMode {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function readThemePreference(username: string): ThemePreference {
  const value = localStorage.getItem(keyFor(username));
  return value === "light" || value === "dark" ? value : "system";
}

export function writeThemePreference(username: string, value: ThemePreference): void {
  localStorage.setItem(keyFor(username), value);
}

export function applyTheme(theme: ThemeMode, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}
```

- [ ] **Step 4: Add pre-render theme bootstrap**

In `index.html`, place this script before the application module:

```html
<script>
  (() => {
    const username = localStorage.getItem("softui:lastUsername") || "anonymous";
    const saved = localStorage.getItem(`softui:theme:${username}`);
    const theme = saved === "light" || saved === "dark"
      ? saved
      : (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  })();
</script>
```

Import `tokens.css` and `base.css` from `src/main.tsx` before app code.

- [ ] **Step 5: Define complete semantic tokens**

Create `src/styles/tokens.css` with paired light/dark values for these exact names:

```css
:root,
:root[data-theme="light"] {
  --surface-page: #edf2f6;
  --surface-sidebar: #263846;
  --surface-panel: #ffffff;
  --surface-overlay: #ffffff;
  --text-primary: #213241;
  --text-secondary: #5c6d7b;
  --text-muted: #71808c;
  --text-inverse: #f1f6fa;
  --border-default: #c9d5df;
  --border-subtle: #dce4ea;
  --focus-ring: #2f78b8;
  --action-primary: #236fa8;
  --action-primary-text: #ffffff;
  --action-danger: #c82f38;
  --action-danger-text: #ffffff;
  --action-disabled: #dce4eb;
  --action-disabled-text: #596a78;
  --status-ok: #17623b;
  --status-warning: #8a5a08;
  --status-error: #a1262d;
  --status-info: #185f91;
  --status-debug: #60528d;
  --radius-card: 6px;
  --control-height: 36px;
}

:root[data-theme="dark"] {
  --surface-page: #171f25;
  --surface-sidebar: #0f151a;
  --surface-panel: #202930;
  --surface-overlay: #27323a;
  --text-primary: #e5edf3;
  --text-secondary: #a5b2bd;
  --text-muted: #8796a2;
  --text-inverse: #08141d;
  --border-default: #45535e;
  --border-subtle: #34414a;
  --focus-ring: #58a8dc;
  --action-primary: #4091c8;
  --action-primary-text: #08141d;
  --action-danger: #e1494e;
  --action-danger-text: #ffffff;
  --action-disabled: #252e35;
  --action-disabled-text: #8796a2;
  --status-ok: #7fd3a4;
  --status-warning: #ffd082;
  --status-error: #ff8a8f;
  --status-info: #8bc8ef;
  --status-debug: #c1b6ed;
}
```

Use only these tokens in `base.css` for body, buttons, inputs, focus, disabled states, links and selections.

- [ ] **Step 6: Run tests and build**

```powershell
npm.cmd run test:unit -- src/state/themeStore.test.ts
npm.cmd run build
```

Expected: both commands exit `0`.

- [ ] **Step 7: Commit theme infrastructure**

```powershell
git add index.html src/main.tsx src/state src/styles
git commit -m "feat: add flash-free semantic theme system"
```

### Task 3: Build Navigation And Shell Components

**Files:**
- Create: `src/app/navigation.ts`
- Create: `src/components/layout/SidebarNav.tsx`
- Create: `src/components/layout/GlobalStatusBar.tsx`
- Create: `src/components/layout/PageTabs.tsx`
- Create: `src/components/layout/AppFooter.tsx`
- Create: `src/app/AppShell.tsx`
- Create: `src/app/AppShell.test.tsx`
- Create: `src/styles/shell.css`

**Interfaces:**
- Produces: `NavigationItem`, `navigationGroups`, `AppShellProps`
- Consumes: `RuntimeSnapshot`, `DeviceConnectionRecord`, `DeviceRuntimeStatusView`

- [ ] **Step 1: Write the failing shell test**

Create `src/app/AppShell.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("keeps current device and emergency stop visible", () => {
    render(
      <MemoryRouter>
        <AppShell
          currentDeviceLabel="STM32-A"
          connectionLabel="COM3 Ready"
          enabled={false}
          recording={false}
          emergencyLatched={false}
          footerItems={["采样 100 Hz", "命令队列 0"]}
          onEmergencyStop={vi.fn()}
        >
          <div>页面内容</div>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByText("STM32-A")).toBeVisible();
    expect(screen.getByRole("button", { name: "紧急停止" })).toBeVisible();
    expect(screen.getByText("页面内容")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
npm.cmd run test:unit -- src/app/AppShell.test.tsx
```

Expected: FAIL because `AppShell` is missing.

- [ ] **Step 3: Define navigation once**

Create `src/app/navigation.ts`:

```ts
import { BarChart3, Cpu, Database, LayoutDashboard, Logs, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PageKey } from "../softuiTypes";

export interface NavigationItem {
  key: PageKey;
  path: string;
  label: string;
  icon: LucideIcon;
}

export const navigationGroups = [
  { label: "运行", items: [
    { key: "Dashboard", path: "/dashboard", label: "总览", icon: LayoutDashboard },
    { key: "Workspace", path: "/workspace", label: "设备工作台", icon: Cpu },
    { key: "Charts", path: "/charts", label: "曲线分析", icon: BarChart3 },
  ] },
  { label: "数据", items: [
    { key: "Sessions", path: "/sessions", label: "会话与记录", icon: Database },
    { key: "Logs", path: "/logs", label: "日志与诊断", icon: Logs },
  ] },
  { label: "系统", items: [
    { key: "Settings", path: "/settings", label: "系统设置", icon: Settings2 },
  ] },
] satisfies Array<{ label: string; items: NavigationItem[] }>;
```

- [ ] **Step 4: Implement the shell contract**

`AppShellProps` must be:

```ts
export interface AppShellProps {
  children: React.ReactNode;
  currentDeviceLabel: string;
  connectionLabel: string;
  enabled: boolean;
  recording: boolean;
  emergencyLatched: boolean;
  footerItems: string[];
  onEmergencyStop: () => void;
}
```

`GlobalStatusBar` renders device, connection, enabled, recording and one danger button with `aria-label="紧急停止"`. `SidebarNav` renders `navigationGroups`; `AppFooter` renders `footerItems`; `AppShell` composes all four regions.

- [ ] **Step 5: Add stable shell CSS**

Create `src/styles/shell.css` with exact tracks:

```css
.app-shell {
  min-height: 100vh;
  height: 100vh;
  display: grid;
  grid-template-columns: 224px minmax(0, 1fr);
  grid-template-rows: 56px minmax(0, 1fr) 28px;
  overflow: hidden;
  background: var(--surface-page);
  color: var(--text-primary);
}

.app-sidebar { grid-row: 1 / -1; min-width: 0; }
.global-status-bar { grid-column: 2; min-width: 0; }
.app-content { grid-column: 2; min-width: 0; min-height: 0; overflow: hidden; }
.app-footer { grid-column: 2; min-width: 0; }

@media (max-width: 1439px) {
  .app-shell { grid-template-columns: 72px minmax(0, 1fr); }
}
```

- [ ] **Step 6: Run tests and build**

```powershell
npm.cmd run test:unit -- src/app/AppShell.test.tsx
npm.cmd run build
```

Expected: both commands exit `0`.

- [ ] **Step 7: Commit the shell**

```powershell
git add src/app src/components/layout src/styles/shell.css
git commit -m "feat: add stable workstation app shell"
```

### Task 4: Add Shared Page Layouts

**Files:**
- Create: `src/layouts/DashboardLayout.tsx`
- Create: `src/layouts/WorkbenchLayout.tsx`
- Create: `src/layouts/ChartLayout.tsx`
- Create: `src/layouts/TableLayout.tsx`
- Create: `src/layouts/SettingsLayout.tsx`
- Create: `src/layouts/layouts.test.tsx`
- Create: `src/styles/layouts.css`

**Interfaces:**
- Produces five layout components using `ReactNode` slots
- Consumes no business state and performs no Tauri calls

- [ ] **Step 1: Write the failing layout tests**

Create `src/layouts/layouts.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkbenchLayout } from "./WorkbenchLayout";
import { TableLayout } from "./TableLayout";

describe("page layouts", () => {
  it("keeps workbench context separate from the task area", () => {
    render(<WorkbenchLayout context={<div>设备上下文</div>} tabs={<div>标签</div>}><div>任务区域</div></WorkbenchLayout>);
    expect(screen.getByText("设备上下文").closest("aside")).toBeTruthy();
    expect(screen.getByText("任务区域").closest("main")).toBeTruthy();
  });

  it("keeps table tools outside the scroll region", () => {
    render(<TableLayout toolbar={<div>筛选</div>}><div>日志列表</div></TableLayout>);
    expect(screen.getByText("筛选")).toBeVisible();
    expect(screen.getByText("日志列表").parentElement).toHaveClass("layout-scroll-region");
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```powershell
npm.cmd run test:unit -- src/layouts/layouts.test.tsx
```

Expected: FAIL because layout components do not exist.

- [ ] **Step 3: Implement slot-based layouts**

Use these exact contracts:

```ts
export interface WorkbenchLayoutProps {
  context: React.ReactNode;
  tabs: React.ReactNode;
  children: React.ReactNode;
}

export interface TableLayoutProps {
  toolbar: React.ReactNode;
  children: React.ReactNode;
  detail?: React.ReactNode;
}
```

The remaining layouts follow the same explicit slots:

- `DashboardLayout`: `summary`, `children`
- `ChartLayout`: `channels`, `toolbar`, `children`
- `SettingsLayout`: `navigation`, `actions`, `children`

Every layout root has `min-height: 0`; only `.layout-scroll-region` uses `overflow: auto`.

- [ ] **Step 4: Add responsive tracks**

`src/styles/layouts.css` must include:

```css
.workbench-layout { height: 100%; display: grid; grid-template-columns: 280px minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 12px; }
.workbench-context { grid-row: 1 / -1; min-height: 0; overflow: auto; }
.chart-layout { height: 100%; display: grid; grid-template-columns: 260px minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 12px; }
.table-layout { height: 100%; display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; }
.settings-layout { height: 100%; display: grid; grid-template-columns: 220px minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); gap: 12px; }

@media (max-width: 1119px) {
  .workbench-layout, .chart-layout, .settings-layout { grid-template-columns: minmax(0, 1fr); }
  .workbench-context, .chart-channels, .settings-navigation { display: none; }
}
```

- [ ] **Step 5: Run tests and build**

```powershell
npm.cmd run test:unit -- src/layouts/layouts.test.tsx
npm.cmd run build
```

Expected: both commands exit `0`.

- [ ] **Step 6: Commit layout primitives**

```powershell
git add src/layouts src/styles/layouts.css
git commit -m "feat: add workstation page layout primitives"
```

### Task 5: Integrate The New Shell Around Existing Routes

**Files:**
- Create: `src/app/AppRouter.tsx`
- Modify: `src/App.tsx:72-112`
- Modify: `src/App.tsx:1523-1727`
- Modify: `src/main.tsx`
- Modify: `src/App.css`
- Test: `src/app/AppRouter.test.tsx`

**Interfaces:**
- Consumes: existing page components and callbacks from `App.tsx`
- Produces: `AppRouter` and one shell instance for every authenticated route

- [ ] **Step 1: Write a failing routing test**

Create `src/app/AppRouter.test.tsx` with a minimal route fixture:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRouter } from "./AppRouter";

describe("AppRouter", () => {
  it("redirects the root to dashboard", () => {
    render(<MemoryRouter initialEntries={["/"]}><AppRouter dashboard={<div>总览内容</div>} workspace={<div />} charts={<div />} sessions={<div />} logs={<div />} settings={<div />} /></MemoryRouter>);
    expect(screen.getByText("总览内容")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```powershell
npm.cmd run test:unit -- src/app/AppRouter.test.tsx
```

Expected: FAIL because `AppRouter` is missing.

- [ ] **Step 3: Implement route slots**

Use this contract:

```ts
export interface AppRouterProps {
  dashboard: React.ReactNode;
  workspace: React.ReactNode;
  charts: React.ReactNode;
  sessions: React.ReactNode;
  logs: React.ReactNode;
  settings: React.ReactNode;
}
```

Map `/`, `/dashboard`, `/workspace`, `/charts`, `/sessions`, `/logs`, `/settings`; retain compatibility redirects for `/connection`, `/live-table`, `/calibration`, `/playback`, and `/model` to `/workspace`.

- [ ] **Step 4: Replace the old shell markup**

In `App.tsx`, keep the existing controller state and callbacks, but replace the `<div className="shell">` branch with:

```tsx
<AppShell
  currentDeviceLabel={snapshot.live.selectedDeviceId || "未选择设备"}
  connectionLabel={snapshot.connection.state}
  enabled={snapshot.connection.state === "enabled"}
  recording={recorderStatus.active}
  emergencyLatched={snapshot.runtimeDiagnostics.emergencyLatched}
  footerItems={[
    `采样 ${snapshot.dashboard.sampleRateHz} Hz`,
    `帧率 ${snapshot.dashboard.frameRateHz} fps`,
    `命令队列 ${snapshot.runtimeDiagnostics.pendingCommands}`,
  ]}
  onEmergencyStop={() => void submitSystemControl("emergencyStop")}
>
  <AppRouter
    dashboard={<DashboardPage snapshot={snapshot} />}
    workspace={
      <WorkspacePage
        snapshot={snapshot}
        serialPorts={serialPorts}
        serialPortsError={serialPortsError}
        connectedDevices={connectedDevices}
        deviceStatuses={deviceStatuses}
        connectionError={connectionError}
        onOpenConnectDialog={toggleConnection}
        onDisconnectDevice={handleDisconnectDevice}
        onRefreshSerialPorts={refreshSerialPorts}
        onSystemControl={submitSystemControl}
        onSendMotor={sendMotorCommand}
        onWorkspaceCommand={submitWorkspaceCommand}
      />
    }
    charts={<ChartsPage snapshot={snapshot} />}
    sessions={
      <SessionsPage
        sessions={sessions}
        recorderStatus={recorderStatus}
        onToggleRecording={toggleRecording}
        onPauseRecording={pauseRecording}
        onResumeRecording={resumeRecording}
        onDeleteSession={deleteSession}
        onRenameSession={renameSession}
        onExportCsv={exportCsv}
        onLoadPlayback={loadPlayback}
      />
    }
    logs={<LogsPageV3 snapshot={snapshot} />}
    settings={
      <SettingsPageV2
        snapshot={snapshot}
        users={users}
        diagnosticsPath={diagnosticsPath}
        migrationSource={migrationSource}
        migrationPreview={migrationPreview}
        migrationReport={migrationReport}
        onToggleTheme={toggleTheme}
        onExportDiagnostics={exportDiagnostics}
        onMigrationSourceChange={setMigrationSource}
        onPreviewMigration={previewMigration}
        onRunMigration={runMigration}
        onCreateUser={createUserAccount}
        onResetUserPassword={resetUserPassword}
        onSetUserDisabled={setUserDisabled}
      />
    }
  />
</AppShell>
```

Do not migrate page internals in this task.

- [ ] **Step 5: Remove only superseded shell CSS**

Delete rules owned by the old `.shell`, `.sidebar`, `.topbar`, `.actions`, and `.summary-row` shell. Keep page CSS until its page migration task removes it.

- [ ] **Step 6: Run the complete phase checks**

```powershell
npm.cmd run test:unit
npm.cmd run test:ui-regressions
npm.cmd run test:layout-regressions
npm.cmd run build
```

Expected: all four commands exit `0`. Update static regression assertions only when the new class names intentionally replace old shell names.

- [ ] **Step 7: Commit shell integration**

```powershell
git add src/App.tsx src/App.css src/main.tsx src/app
git commit -m "refactor: run existing pages inside new app shell"
```

## Phase Verification

Run fresh:

```powershell
npm.cmd run test:unit
npm.cmd run test:ui-regressions
npm.cmd run test:layout-regressions
npm.cmd run build
git status --short
```

Expected: tests and build exit `0`; `git status --short` is empty after the final commit.

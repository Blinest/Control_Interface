# Data Pages And Settings Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把曲线、会话、日志与设置迁移到固定专业模板，完成内部滚动、强空态、长文本和局部工具栏规则。

**Architecture:** 每个业务页面成为独立 feature，使用阶段 1 的 `ChartLayout`、`TableLayout`、`SettingsLayout` 或 `WorkbenchLayout`。页面只接收数据和回调，不直接调用 Tauri；筛选、选择和详情状态保留在 feature 内。

**Tech Stack:** React 19, TypeScript, uPlot, TanStack Table, Vitest, Testing Library, lucide-react, existing Tauri client.

## Global Constraints

- 曲线、会话、日志和设置不允许自由卡片布局。
- 表格、日志和图表在内部滚动；页面框架不能静默裁切。
- 空态必须说明状态、原因、下一步操作和相关设备或路径。
- 长路径使用专用组件；表格省略必须配 tooltip 或详情抽屉。
- 日志级别显示 `warning`、`error`、`info`、`bug`，其中 `bug` 映射内部 `debug`。
- 设置一次只显示一个分类，账户、诊断和迁移不得并排堆卡。
- 页面组件不直接调用 Tauri `invoke`。
- 不替换 uPlot、Three.js、TanStack Table 或现有后端命令。

---

## File Structure

```text
src/
  components/data/
    EmptyState.tsx
    PathValue.tsx
    StatusBadge.tsx
  features/charts/
    ChartsPage.tsx
    ChannelSidebar.tsx
    ChartToolbar.tsx
  features/sessions/
    SessionsPage.tsx
    RecorderWorkbench.tsx
    SessionsTable.tsx
  features/logs/
    LogsPage.tsx
    LogFilters.tsx
    LogDetailDrawer.tsx
    logFilters.ts
  features/settings/
    SettingsPage.tsx
    SettingsNavigation.tsx
    ApplicationSettings.tsx
    AppearanceSettings.tsx
    ConnectionSettings.tsx
    AccountSettings.tsx
    DiagnosticsSettings.tsx
    MigrationSettings.tsx
```

### Task 1: Add Shared Empty, Path And Status Components

**Files:**
- Create: `src/components/data/EmptyState.tsx`
- Create: `src/components/data/PathValue.tsx`
- Create: `src/components/data/StatusBadge.tsx`
- Create: `src/components/data/data-components.test.tsx`
- Create: `src/components/data/data.css`

**Interfaces:**
- Produces: `EmptyStateProps`, `PathValueProps`, `StatusBadgeProps`

- [ ] **Step 1: Write failing shared-component tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";
import { PathValue } from "./PathValue";

describe("data components", () => {
  it("requires an actionable empty-state explanation", () => {
    render(<EmptyState title="暂无会话" reason="尚未开始录制" context="设备：STM32-A" action={<button>开始录制</button>} />);
    expect(screen.getByText("尚未开始录制")).toBeVisible();
    expect(screen.getByRole("button", { name: "开始录制" })).toBeVisible();
  });

  it("keeps the full path available", () => {
    render(<PathValue value="D:\\APP\\ControlUI\\sessions\\very-long-name" />);
    expect(screen.getByTitle("D:\\APP\\ControlUI\\sessions\\very-long-name")).toBeVisible();
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

```powershell
npm.cmd run test:unit -- src/components/data/data-components.test.tsx
```

Expected: FAIL because components are missing.

- [ ] **Step 3: Implement exact contracts**

```ts
export interface EmptyStateProps {
  title: string;
  reason: string;
  context?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ size?: number }>;
}

export interface PathValueProps {
  value: string;
  compact?: boolean;
}
```

`EmptyState` reserves at least `280px`, centers one content group and never renders only a title. `PathValue` uses wrapping by default and one-line truncation plus title when compact.

- [ ] **Step 4: Run tests and build**

```powershell
npm.cmd run test:unit -- src/components/data/data-components.test.tsx
npm.cmd run build
```

Expected: both commands exit `0`.

- [ ] **Step 5: Commit**

```powershell
git add src/components/data
git commit -m "feat: add shared empty and long-value components"
```

### Task 2: Migrate The Charts Page

**Files:**
- Move/Modify: `src/charts.tsx` -> `src/features/charts/ChartsPage.tsx`
- Create: `src/features/charts/ChannelSidebar.tsx`
- Create: `src/features/charts/ChartToolbar.tsx`
- Create: `src/features/charts/ChartsPage.test.tsx`
- Create: `src/features/charts/charts.css`
- Modify: `src/app/AppRouter.tsx`

**Interfaces:**
- Consumes: `snapshot: RuntimeSnapshot`, current device ID
- Preserves: existing uPlot adapter, zoom, pause and channel calculations
- Produces: `ChartsPage`

- [ ] **Step 1: Write a failing layout behavior test**

```tsx
import { fixtureSnapshot } from "../../test/fixtures/fixtureSnapshot";

it("keeps channel controls separate from the chart canvas", () => {
  render(<ChartsPage snapshot={fixtureSnapshot} currentDeviceId="softui-sim-01" />);
  expect(screen.getByRole("complementary", { name: "曲线通道" })).toBeVisible();
  expect(screen.getByRole("region", { name: "曲线绘图区" })).toBeVisible();
  expect(screen.getByRole("button", { name: "重置缩放" })).toBeVisible();
});
```

- [ ] **Step 2: Run the test to verify failure**

```powershell
npm.cmd run test:unit -- src/features/charts/ChartsPage.test.tsx
```

Expected: FAIL because the feature path is missing.

- [ ] **Step 3: Split controls from rendering**

Move channel toggles, raw/filtered mode and channel metadata into `ChannelSidebar`; move real-time/history, pause, time window, reset zoom and export commands into `ChartToolbar`. Keep chart creation and destruction in `ChartsPage` so one adapter owns the uPlot instance.

- [ ] **Step 4: Apply ChartLayout**

```tsx
<ChartLayout
  channels={
    <ChannelSidebar
      channels={snapshot.charts.channels}
      selectedChannelIds={selectedChannelIds}
      onSelectionChange={setSelectedChannelIds}
    />
  }
  toolbar={
    <ChartToolbar
      paused={paused}
      mode={mode}
      onPauseChange={setPaused}
      onModeChange={setMode}
      onResetZoom={resetZoom}
    />
  }
>
  <section className="chart-canvas-region" aria-label="曲线绘图区" ref={chartHostRef} />
</ChartLayout>
```

The canvas region uses `min-width: 0`, `min-height: 0`, `height: 100%`; no outer panel padding reduces plot size.

- [ ] **Step 5: Run tests, static checks and build**

```powershell
npm.cmd run test:unit -- src/features/charts/ChartsPage.test.tsx
npm.cmd run test:layout-regressions
npm.cmd run build
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit**

```powershell
git add src/features/charts src/app/AppRouter.tsx src/charts.tsx scripts
git commit -m "refactor: migrate charts to full-height chart layout"
```

### Task 3: Migrate Sessions Into Recorder And History Regions

**Files:**
- Move/Modify: `src/pages/SessionsPage.tsx` -> `src/features/sessions/SessionsPage.tsx`
- Create: `src/features/sessions/RecorderWorkbench.tsx`
- Create: `src/features/sessions/SessionsTable.tsx`
- Create: `src/features/sessions/SessionsPage.test.tsx`
- Create: `src/features/sessions/sessions.css`
- Modify: `src/app/AppRouter.tsx`

**Interfaces:**
- Consumes existing `SessionsPageProps` callbacks and data unchanged
- Produces full-height recorder/history layout and centralized session delete confirmation

- [ ] **Step 1: Write failing sessions tests**

```tsx
const sessionCallbacks = {
  onToggleRecording: vi.fn(),
  onPauseRecording: vi.fn(),
  onResumeRecording: vi.fn(),
  onDeleteSession: vi.fn(),
  onRenameSession: vi.fn(),
  onExportCsv: vi.fn(),
  onLoadPlayback: vi.fn(),
};

it("fills the empty history area with context and action", () => {
  render(
    <SessionsPage
      snapshot={fixtureSnapshot}
      sessions={[]}
      recorderStatus={{ active: false, sessionId: "", sessionName: "", frameCount: 0, elapsedSecs: 0, paused: false }}
      {...sessionCallbacks}
    />,
  );
  expect(screen.getByRole("heading", { name: "暂无录制会话" })).toBeVisible();
  expect(screen.getByText(/保存目录/)).toBeVisible();
  expect(screen.getByRole("button", { name: "开始录制" })).toBeVisible();
});

it("confirms before deleting a session", async () => {
  const fixtureSession: SessionInfo = {
    id: "session-1",
    name: "弯曲测试 1",
    startTime: "2026-07-29T10:00:00Z",
    endTime: "2026-07-29T10:00:01Z",
    deviceId: "softui-sim-01",
    frameCount: 100,
    fileSize: 4096,
    filePath: "D:\\APP\\ControlUI\\sessions\\session-1",
  };
  render(
    <SessionsPage
      snapshot={fixtureSnapshot}
      sessions={[fixtureSession]}
      recorderStatus={{ active: false, sessionId: "", sessionName: "", frameCount: 0, elapsedSecs: 0, paused: false }}
      {...sessionCallbacks}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: `删除 ${fixtureSession.name}` }));
  expect(screen.getByRole("alertdialog", { name: "确认删除会话" })).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify failure**

```powershell
npm.cmd run test:unit -- src/features/sessions/SessionsPage.test.tsx
```

Expected: tests fail against the old page behavior.

- [ ] **Step 3: Split recorder and table responsibilities**

`RecorderWorkbench` receives recorder status and start/pause/resume/stop callbacks. `SessionsTable` owns TanStack Table setup, search, row selection, rename, playback, export and delete intent.

- [ ] **Step 4: Replace local delete UI with central confirmation**

Route delete through `useSafeCommand().execute("deleteSession", { sessionId, sessionName }, action)`. Remove `confirmDeleteId` and inline confirmation markup from the old page.

- [ ] **Step 5: Apply full-height layout and strong empty state**

Use a two-column `WorkbenchLayout` variant with `RecorderWorkbench` as context and the history table as the main region. Empty history uses `EmptyState` with device ID, `snapshot.settings.dataDirectory`, and a start-recording action.

- [ ] **Step 6: Run tests and build**

```powershell
npm.cmd run test:unit -- src/features/sessions/SessionsPage.test.tsx
npm.cmd run test:layout-regressions
npm.cmd run build
```

Expected: all commands exit `0`.

- [ ] **Step 7: Commit**

```powershell
git add src/features/sessions src/pages/SessionsPage.tsx src/app/AppRouter.tsx scripts
git commit -m "refactor: migrate sessions to recorder workbench layout"
```

### Task 4: Migrate Logs With Four Filters And Detail Drawer

**Files:**
- Create: `src/features/logs/logFilters.ts`
- Create: `src/features/logs/logFilters.test.ts`
- Create: `src/features/logs/LogFilters.tsx`
- Create: `src/features/logs/LogDetailDrawer.tsx`
- Create: `src/features/logs/LogsPage.tsx`
- Create: `src/features/logs/LogsPage.test.tsx`
- Create: `src/features/logs/logs.css`
- Modify: `src/app/AppRouter.tsx`
- Modify: `src/App.tsx:1833-1960`

**Interfaces:**
- Produces: `VisibleLogLevel = "warning" | "error" | "info" | "bug"`
- Produces: `toVisibleLevel`, `filterLogs`
- Consumes: `LogEntry[]`

- [ ] **Step 1: Write failing level mapping tests**

```ts
import { describe, expect, it } from "vitest";
import { filterLogs, toVisibleLevel } from "./logFilters";

describe("log filters", () => {
  it("maps warn and debug to user-facing names", () => {
    expect(toVisibleLevel("warn")).toBe("warning");
    expect(toVisibleLevel("debug")).toBe("bug");
  });

  it("filters debug entries with the bug filter", () => {
    expect(filterLogs([{ id: "1", level: "debug", message: "x" } as never], { levels: ["bug"], query: "" })).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Implement mapping and filtering**

```ts
export type VisibleLogLevel = "warning" | "error" | "info" | "bug";

export const toVisibleLevel = (level: LogLevel): VisibleLogLevel =>
  level === "warn" ? "warning" : level === "debug" ? "bug" : level;
```

`filterLogs` applies selected levels, query, optional scope, device ID and session ID without mutating input.

- [ ] **Step 3: Write failing page tests**

```tsx
it("shows exactly four user-facing level filters", () => {
  render(<LogsPage logs={fixtureLogs} onExportDiagnostics={vi.fn()} />);
  for (const level of ["warning", "error", "info", "bug"]) {
    expect(screen.getByRole("checkbox", { name: level })).toBeVisible();
  }
});

it("opens the full message in a detail drawer", async () => {
  render(<LogsPage logs={fixtureLogs} onExportDiagnostics={vi.fn()} />);
  await userEvent.click(screen.getByText(fixtureLogs[0].message));
  expect(screen.getByRole("complementary", { name: "日志详情" })).toBeVisible();
});
```

- [ ] **Step 4: Build TableLayout page**

Toolbar contains level checkboxes, query, device/session filters and export diagnostics. The scroll region renders compact rows; selected row opens `LogDetailDrawer` with timestamp, internal level, module, device/session IDs and complete message.

- [ ] **Step 5: Remove old LogsPage variants**

Delete `LogsPage`, `LogsPageV2`, `LogsPageV3` from `App.tsx` after routing the feature page. Update static regression checks to assert the new feature path and four labels.

- [ ] **Step 6: Run tests and build**

```powershell
npm.cmd run test:unit -- src/features/logs
npm.cmd run test:layout-regressions
npm.cmd run build
```

Expected: all commands exit `0`.

- [ ] **Step 7: Commit**

```powershell
git add src/features/logs src/App.tsx src/app/AppRouter.tsx scripts
git commit -m "refactor: migrate logs to filtered diagnostic table"
```

### Task 5: Migrate Settings Into Categories

**Files:**
- Create: `src/features/settings/settingsSections.ts`
- Create: `src/features/settings/SettingsNavigation.tsx`
- Create: `src/features/settings/ApplicationSettings.tsx`
- Create: `src/features/settings/AppearanceSettings.tsx`
- Create: `src/features/settings/ConnectionSettings.tsx`
- Create: `src/features/settings/AccountSettings.tsx`
- Create: `src/features/settings/DiagnosticsSettings.tsx`
- Create: `src/features/settings/MigrationSettings.tsx`
- Create: `src/features/settings/SettingsPage.tsx`
- Create: `src/features/settings/SettingsPage.test.tsx`
- Create: `src/features/settings/settings.css`
- Modify: `src/app/AppRouter.tsx`
- Modify: `src/App.tsx:1962-2430`

**Interfaces:**
- Produces: `SettingsSection = "application" | "appearance" | "connection" | "accounts" | "diagnostics" | "migration"`
- Consumes existing settings, users, diagnostics and migration callbacks

- [ ] **Step 1: Write failing settings navigation tests**

```tsx
const settingsProps: SettingsPageProps = {
  snapshot: fixtureSnapshot,
  users: [],
  diagnosticsPath: "",
  migrationSource: "",
  migrationPreview: null,
  migrationReport: null,
  onThemePreferenceChange: vi.fn(),
  onExportDiagnostics: vi.fn(),
  onMigrationSourceChange: vi.fn(),
  onPreviewMigration: vi.fn(),
  onRunMigration: vi.fn(),
  onCreateUser: vi.fn(),
  onResetUserPassword: vi.fn(),
  onSetUserDisabled: vi.fn(),
  onResetLayouts: vi.fn(),
};

it("renders only the selected settings category", async () => {
  render(<SettingsPage {...settingsProps} />);
  expect(screen.getByRole("heading", { name: "应用与路径" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "账户与权限" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "账户与权限" }));
  expect(screen.getByRole("heading", { name: "账户与权限" })).toBeVisible();
  expect(screen.queryByRole("heading", { name: "数据迁移" })).not.toBeInTheDocument();
});
```

Export `SettingsPageProps` from `SettingsPage.tsx` and keep it identical to `settingsProps` above.

- [ ] **Step 2: Run the test to verify failure**

```powershell
npm.cmd run test:unit -- src/features/settings/SettingsPage.test.tsx
```

Expected: FAIL because the categorized feature page is missing.

- [ ] **Step 3: Define category metadata**

```ts
export type SettingsSection = "application" | "appearance" | "connection" | "accounts" | "diagnostics" | "migration";

export const settingsSections = [
  { id: "application", label: "应用与路径" },
  { id: "appearance", label: "外观与布局" },
  { id: "connection", label: "连接配置" },
  { id: "accounts", label: "账户与权限" },
  { id: "diagnostics", label: "日志与诊断" },
  { id: "migration", label: "数据迁移" },
] as const;
```

- [ ] **Step 4: Move each responsibility into one component**

Use existing callback contracts without direct invokes. `AppearanceSettings` controls `ThemePreference`, density and reset layouts. `AccountSettings` uses central confirmation for password reset, role/disabled changes. `MigrationSettings` confirms before running migration, but preview remains immediate.

- [ ] **Step 5: Apply SettingsLayout and path handling**

Left navigation uses `role="tablist"`; right side mounts only the active category. All path values use `PathValue`. Save/cancel actions appear in the layout action slot only for categories with editable drafts.

- [ ] **Step 6: Remove old settings variants**

Delete `SettingsPage` and `SettingsPageV2` from `App.tsx` after routing the new page. Remove CSS selectors based on `.panel:nth-child()` because section order no longer controls layout.

- [ ] **Step 7: Run complete phase checks**

```powershell
npm.cmd run test:unit
npm.cmd run test:ui-regressions
npm.cmd run test:layout-regressions
npm.cmd run build
```

Expected: all commands exit `0`.

- [ ] **Step 8: Commit**

```powershell
git add src/features/settings src/App.tsx src/app/AppRouter.tsx src/App.css scripts
git commit -m "refactor: migrate settings to categorized layout"
```

## Phase Verification

```powershell
npm.cmd run test:unit
npm.cmd run test:ui-regressions
npm.cmd run test:layout-regressions
npm.cmd run build
git status --short
```

Expected: all checks pass and the worktree is clean.

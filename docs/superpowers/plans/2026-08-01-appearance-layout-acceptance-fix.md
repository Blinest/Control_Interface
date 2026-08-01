# Appearance Layout Acceptance Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 SoftUI 当前外观和布局收口问题，让桌面上位机界面达到可验收状态：中文可读、色调一致、按钮/文字对比清晰、无可见垂直滚动条、关键功能不被隐藏、卡片可直接拖拽/拉伸、页面没有大面积无意义空白，并建立真实窗口截图验收。

**Architecture:** 先修复文案和主题 token，确保视觉基础可信；再清理布局系统，禁止通过 `display: none` 或 `overflow: hidden` 裁掉功能；随后把可自定义卡片改为直接拖拽/拉伸和自动保存，移除“调整布局/编辑布局”这类显式按钮；最后引入真实浏览器截图验收，覆盖浅色/深色和核心页面，防止后续外观退化。

**Tech Stack:** React 19, TypeScript, CSS tokens, Vitest, Testing Library, dnd-kit, Vite, optional Playwright for visual smoke verification, Tauri 2 desktop runtime.

## Global Constraints

- 不改动下位机协议语义、串口通信约定、Rust 控制算法或安全命令语义。
- 不使用、启动、复制或校验 sibling projects，例如 `ThreeSoft`。
- SoftUI Tauri 项目路径固定为 `D:\APP\ControlUI\softui-desktop\.worktrees\ui-foundation-shell`。
- SoftUI dev port 固定为 `1421`，打开应用前必须清理 SoftUI-owned `1421` dev server 和旧 SoftUI 窗口，不停止无关服务。
- 页面框架不得出现可见垂直滚动条；内部区域可以滚动，但滚动条必须隐藏，同时鼠标滚轮和触控滚动可用。
- 不允许为了适配窗口而隐藏关键功能区域；设备上下文、曲线通道、设置导航、回放控制、急停/恢复状态必须始终有可达路径。
- 不出现文字按钮“调整布局”或“编辑布局”；自定义卡片页面应支持用户直接拖拽排序、拖拽拉伸、自动保存。
- 禁用态按钮必须有明确背景色、边框色和文字色，不得只依赖 `opacity`。
- 长路径、设备 ID、日志内容、会话名必须可读：紧凑态可省略，但必须有 title 或详情；普通态应换行。
- 页面不允许大面积无意义空白；空态必须说明状态、原因、下一步动作和相关设备/路径。
- 每个行为变更优先写失败测试，再实现，再验证。

---

## File Structure

```text
src/
  app/
    AppShell.tsx
    AppShell.test.tsx
  components/
    cards/
      CardLayoutEditor.tsx
      CardResizeHandle.tsx
      cards.css
      directCardLayout.test.tsx
    data/
      EmptyState.tsx
      PathValue.tsx
      data-components.test.tsx
    layout/
      ResponsiveRail.tsx
      ResponsiveRail.test.tsx
  features/
    charts/
      ChannelSidebar.tsx
      ChartsPage.test.tsx
      charts.css
    dashboard/
      DashboardPage.tsx
      DashboardPage.test.tsx
      dashboard.css
    device-workspace/
      DeviceWorkspacePage.test.tsx
      deviceWorkspace.css
    sessions/
      SessionsPage.test.tsx
      sessions.css
    logs/
      LogsPage.test.tsx
      logs.css
    settings/
      SettingsPage.test.tsx
      settings.css
  styles/
    base.css
    layouts.css
    shell.css
    tokens.css
    visualText.test.ts
scripts/
  verify-layout-regressions.mjs
  verify-visual-smoke.mjs
```

### Task 1: Restore Readable Chinese Copy And Add Mojibake Guard

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/feedback/ErrorBoundary.tsx`
- Modify: `src/components/cards/CardLayoutEditor.tsx`
- Modify: `src/features/dashboard/DashboardPage.tsx`
- Modify: `src/features/device-workspace/DeviceWorkspacePage.tsx`
- Modify: `src/features/charts/ChartsPage.tsx`
- Modify: `src/features/logs/LogsPage.tsx`
- Modify: `src/features/sessions/SessionsPage.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`
- Create: `src/styles/visualText.test.ts`
- Modify: `scripts/verify-ui-regressions.mjs`

**Interfaces:**
- Produces a shared mojibake denylist used by unit/static tests.
- Preserves existing component props and behavior.

- [ ] **Step 1: Write failing mojibake test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const checkedFiles = [
  "src/App.tsx",
  "src/components/feedback/ErrorBoundary.tsx",
  "src/components/cards/CardLayoutEditor.tsx",
  "src/features/dashboard/DashboardPage.tsx",
  "src/features/device-workspace/DeviceWorkspacePage.tsx",
  "src/features/charts/ChartsPage.tsx",
  "src/features/logs/LogsPage.tsx",
  "src/features/sessions/SessionsPage.tsx",
  "src/features/settings/SettingsPage.tsx",
];

const mojibakePatterns = [/涓/, /鏃/, /鐧/, /璁/, /鎬/, /浼/, /绾/, /鍘/, /褰/, /榧/];

describe("visible Chinese copy", () => {
  it("does not contain mojibake in user-facing source files", () => {
    const offenders = checkedFiles.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return mojibakePatterns.some((pattern) => pattern.test(text)) ? [file] : [];
    });
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```powershell
npm.cmd run test:unit -- src/styles/visualText.test.ts
```

Expected: FAIL because current source contains mojibake strings.

- [ ] **Step 3: Replace visible mojibake with approved Chinese text**

Use these concrete replacements where matching intent is clear:

```text
上位机登录
请先完成本地认证，再进入设备控制工作区。
用户名
密码
登录中
登录
首次安装默认管理员为 admin / admin123，登录后必须修改密码。
当前密码
新密码
提交中
修改密码并进入
当前设备
未选择设备
采样
帧率
命令队列
急停已锁定
恢复控制
会话与记录
历史会话
暂无录制会话
尚未开始录制，停止后会话会出现在这里。
保存目录
开始录制
日志详情
暂无日志
暂无匹配日志
级别
时间
模块
消息
设备工作台视图
监控
实时数据
手动控制
自动控制
回放
当前视图
界面发生错误
应用捕获到渲染异常，可重新加载界面继续操作。
重新加载
```

For ambiguous strings, prefer concise industrial-control wording over marketing language.

- [ ] **Step 4: Add static regression guard**

In `scripts/verify-ui-regressions.mjs`, add:

```js
const visibleSources = [
  "../src/App.tsx",
  "../src/components/feedback/ErrorBoundary.tsx",
  "../src/components/cards/CardLayoutEditor.tsx",
  "../src/features/dashboard/DashboardPage.tsx",
  "../src/features/device-workspace/DeviceWorkspacePage.tsx",
  "../src/features/charts/ChartsPage.tsx",
  "../src/features/logs/LogsPage.tsx",
  "../src/features/sessions/SessionsPage.tsx",
  "../src/features/settings/SettingsPage.tsx",
].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n");

assert.doesNotMatch(visibleSources, /涓|鏃|鐧|璁|鎬|浼|绾|鍘|褰|榧/, "visible copy must not contain mojibake");
```

- [ ] **Step 5: Verify and commit**

```powershell
npm.cmd run test:unit -- src/styles/visualText.test.ts
npm.cmd run test:ui-regressions
npm.cmd run build
git add src scripts/verify-ui-regressions.mjs
git commit -m "fix: restore readable interface copy"
```

### Task 2: Normalize Theme Tokens, Button Contrast And Disabled States

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/base.css`
- Modify: `src/App.css`
- Modify: `src/styles/tokens.test.ts`
- Modify: `scripts/verify-ui-regressions.mjs`

**Interfaces:**
- Produces semantic color variables for button states:
  - `--button-default-bg`
  - `--button-default-text`
  - `--button-default-border`
  - `--button-primary-bg`
  - `--button-primary-text`
  - `--button-danger-bg`
  - `--button-danger-text`
  - `--button-disabled-bg`
  - `--button-disabled-text`
  - `--button-disabled-border`

- [ ] **Step 1: Write failing token tests**

Add to `src/styles/tokens.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokens = readFileSync("src/styles/tokens.css", "utf8");
const appCss = readFileSync("src/App.css", "utf8");

describe("button contrast tokens", () => {
  it("defines explicit button and disabled colors for both themes", () => {
    for (const name of [
      "--button-default-bg",
      "--button-default-text",
      "--button-default-border",
      "--button-primary-bg",
      "--button-primary-text",
      "--button-danger-bg",
      "--button-danger-text",
      "--button-disabled-bg",
      "--button-disabled-text",
      "--button-disabled-border",
    ]) {
      expect(tokens).toContain(name);
    }
  });

  it("does not rely on opacity for disabled button readability", () => {
    expect(appCss).not.toMatch(/button:disabled\s*\{[^}]*opacity:\s*0\.[0-9]/);
  });
});
```

- [ ] **Step 2: Run test to verify failure**

```powershell
npm.cmd run test:unit -- src/styles/tokens.test.ts
```

Expected: FAIL until new button tokens are defined and opacity-only disabled styles are removed.

- [ ] **Step 3: Define button tokens**

Use restrained, non-monochrome colors:

```css
:root,
:root[data-theme="light"] {
  --button-default-bg: #f7fafc;
  --button-default-text: #213241;
  --button-default-border: #b9c8d5;
  --button-primary-bg: #236fa8;
  --button-primary-text: #ffffff;
  --button-danger-bg: #c82f38;
  --button-danger-text: #ffffff;
  --button-disabled-bg: #dce4eb;
  --button-disabled-text: #4f6070;
  --button-disabled-border: #b8c7d6;
}

:root[data-theme="dark"] {
  --button-default-bg: #25313a;
  --button-default-text: #e5edf3;
  --button-default-border: #51616d;
  --button-primary-bg: #58a8dc;
  --button-primary-text: #08141d;
  --button-danger-bg: #e1494e;
  --button-danger-text: #ffffff;
  --button-disabled-bg: #27323a;
  --button-disabled-text: #9baab6;
  --button-disabled-border: #43525d;
}
```

- [ ] **Step 4: Apply tokens to button classes**

Update `.ghost-btn`, `.primary-btn`, `.ghost-btn-sm`, `.emergency-stop-button`, `.global-account-control`, and disabled selectors to use token variables. Keep disabled `opacity: 1`.

- [ ] **Step 5: Add static regression checks**

```js
assert.match(css, /--button-disabled-bg/);
assert.match(css, /--button-disabled-text/);
assert.doesNotMatch(css, /button:disabled\s*\{[^}]*opacity:\s*0\.[0-9]/);
```

- [ ] **Step 6: Verify and commit**

```powershell
npm.cmd run test:unit -- src/styles/tokens.test.ts
npm.cmd run test:ui-regressions
npm.cmd run build
git add src/styles src/App.css scripts/verify-ui-regressions.mjs
git commit -m "style: normalize theme and button contrast tokens"
```

### Task 3: Replace Hidden Responsive Regions With Reachable Rails

**Files:**
- Create: `src/components/layout/ResponsiveRail.tsx`
- Create: `src/components/layout/ResponsiveRail.test.tsx`
- Modify: `src/layouts/WorkbenchLayout.tsx`
- Modify: `src/layouts/ChartLayout.tsx`
- Modify: `src/layouts/SettingsLayout.tsx`
- Modify: `src/styles/layouts.css`
- Modify: `scripts/verify-layout-regressions.mjs`

**Interfaces:**
- Produces:

```ts
export interface ResponsiveRailProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}
```

- [ ] **Step 1: Write failing reachability test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartLayout } from "../../layouts/ChartLayout";

describe("responsive layout rails", () => {
  it("keeps chart channels reachable through a labelled rail", () => {
    render(
      <ChartLayout channels={<button>通道 A</button>} toolbar={<button>刷新</button>} channelsLabel="曲线通道">
        <div>plot</div>
      </ChartLayout>,
    );
    expect(screen.getByRole("complementary", { name: "曲线通道" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "通道 A" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify current behavior gap**

```powershell
npm.cmd run test:unit -- src/components/layout/ResponsiveRail.test.tsx
```

Expected: FAIL because `ResponsiveRail` does not exist and current CSS hides rail content at narrow widths.

- [ ] **Step 3: Implement `ResponsiveRail`**

```tsx
export function ResponsiveRail({ label, children, className }: ResponsiveRailProps) {
  return (
    <aside className={`responsive-rail ${className ?? ""}`} aria-label={label}>
      <div className="responsive-rail-title">{label}</div>
      <div className="responsive-rail-scroll">{children}</div>
    </aside>
  );
}
```

- [ ] **Step 4: Replace direct sidebars in layout primitives**

Use `ResponsiveRail` inside `WorkbenchLayout`, `ChartLayout`, and `SettingsLayout`. Do not remove content at any breakpoint. At narrow widths, stack rail above main content or make it a horizontal scrollable strip.

- [ ] **Step 5: Remove hidden-region CSS**

Delete this behavior from `src/styles/layouts.css`:

```css
.workbench-context,
.chart-channels,
.settings-navigation {
  display: none;
}
```

Replace it with:

```css
@media (max-width: 1119px) {
  .workbench-layout,
  .chart-layout,
  .settings-layout {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr);
  }

  .workbench-context,
  .chart-channels,
  .settings-navigation {
    grid-row: auto;
    max-height: 220px;
  }

  .responsive-rail-scroll {
    min-height: 0;
    overflow: auto;
  }
}
```

- [ ] **Step 6: Add regression checks**

```js
assert.doesNotMatch(layoutsCss, /display:\s*none[\s\S]*workbench-context|workbench-context[\s\S]*display:\s*none/);
assert.doesNotMatch(layoutsCss, /chart-channels[\s\S]*display:\s*none/);
assert.doesNotMatch(layoutsCss, /settings-navigation[\s\S]*display:\s*none/);
```

- [ ] **Step 7: Verify and commit**

```powershell
npm.cmd run test:unit -- src/components/layout/ResponsiveRail.test.tsx src/layouts/layouts.test.tsx
npm.cmd run test:layout-regressions
npm.cmd run build
git add src/components/layout src/layouts src/styles/layouts.css scripts/verify-layout-regressions.mjs
git commit -m "fix: keep responsive layout rails reachable"
```

### Task 4: Restore Internal Scrolling Without Visible Vertical Scrollbars

**Files:**
- Modify: `src/styles/base.css`
- Modify: `src/styles/layouts.css`
- Modify: `src/features/charts/charts.css`
- Modify: `src/features/sessions/sessions.css`
- Modify: `src/features/logs/logs.css`
- Modify: `src/features/settings/settings.css`
- Modify: `scripts/verify-layout-regressions.mjs`

**Interfaces:**
- Produces `.scrollbar-hidden` utility.
- Ensures `layout-scroll-region`, chart channels, sessions table, logs table, settings main content and table detail use internal scroll.

- [ ] **Step 1: Add static failing assertions**

In `scripts/verify-layout-regressions.mjs`, assert these exact scroll contracts:

```js
assert.match(base, /scrollbar-width:\s*none/, "visible scrollbars must remain hidden");
assert.match(layoutsCss, /\.layout-scroll-region\s*\{[\s\S]*overflow:\s*auto/, "layout scroll regions must be internally scrollable");
assert.match(chartsCss, /\.chart-layout\s+\.charts-sidebar\s*\{[\s\S]*overflow-y:\s*auto/, "chart sidebar must scroll vertically");
assert.match(sessionsCss, /\.sessions-table-region\s*\{[\s\S]*overflow:\s*auto/, "sessions table must scroll internally");
assert.match(logsCss, /\.logs-table-region\s*\{[\s\S]*overflow:\s*auto/, "logs table must scroll internally");
assert.doesNotMatch(css, /\.charts-sidebar\s*\{[\s\S]*overflow:\s*hidden/, "App.css must not clip chart sidebar");
```

- [ ] **Step 2: Run check to verify failure**

```powershell
npm.cmd run test:layout-regressions
```

Expected: FAIL because current `App.css` clips `.charts-sidebar`.

- [ ] **Step 3: Add global hidden-scrollbar utility**

```css
html,
body,
.scrollbar-hidden,
.layout-scroll-region,
.sessions-table-region,
.logs-table-region,
.responsive-rail-scroll,
.feature-card-body {
  scrollbar-width: none;
}

*::-webkit-scrollbar {
  width: 0;
  height: 0;
}
```

- [ ] **Step 4: Correct chart sidebar scrolling**

In `src/features/charts/charts.css`:

```css
.chart-layout .charts-sidebar {
  overflow-x: hidden;
  overflow-y: auto;
}
```

Remove or override any `.charts-sidebar { overflow: hidden; }` from `src/App.css`.

- [ ] **Step 5: Verify and commit**

```powershell
npm.cmd run test:layout-regressions
npm.cmd run build
git add src/styles src/features/charts src/features/sessions src/features/logs src/features/settings src/App.css scripts/verify-layout-regressions.mjs
git commit -m "fix: preserve internal scrolling without visible scrollbars"
```

### Task 5: Remove Layout Edit Buttons And Make Cards Directly Draggable/Resizable

**Files:**
- Modify: `src/components/cards/CardLayoutEditor.tsx`
- Modify: `src/components/cards/CardResizeHandle.tsx`
- Modify: `src/components/cards/SortableCard.tsx`
- Modify: `src/components/cards/cards.css`
- Create: `src/components/cards/directCardLayout.test.tsx`
- Modify: `src/features/dashboard/DashboardPage.tsx`
- Modify: `src/features/dashboard/DashboardPage.test.tsx`
- Modify: `src/features/device-workspace/MonitorPane.tsx`
- Modify: `src/features/device-workspace/DeviceWorkspacePage.test.tsx`

**Interfaces:**
- Produces direct card layout mode:

```ts
export interface DirectCardLayoutProps {
  layout: PageLayout;
  onLayoutChange: (layout: PageLayout) => void;
  childrenForCard: (card: CardPlacement) => React.ReactNode;
}
```

- Removes visible text buttons named `调整布局`, `编辑布局`, `保存布局`, `取消`.
- Keeps reset layout available only in Settings > Appearance.

- [ ] **Step 1: Write failing no-layout-button tests**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DashboardPage } from "../../features/dashboard/DashboardPage";
import { fixtureSnapshot } from "../../test/fixtures/fixtureSnapshot";

describe("direct dashboard layout editing", () => {
  it("does not show layout edit text buttons", () => {
    render(
      <DashboardPage
        snapshot={{ ...fixtureSnapshot, authSession: { ...fixtureSnapshot.authSession, authenticated: true, username: "admin" } }}
        connectedDevices={[]}
        deviceStatuses={{}}
        recorderStatus={{ active: false, sessionId: "", sessionName: "", frameCount: 0, elapsedSecs: 0, paused: false }}
        sessions={[]}
      />,
    );
    expect(screen.queryByRole("button", { name: /调整布局|编辑布局|保存布局|取消/ })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write failing direct resize test**

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardResizeHandle } from "./CardResizeHandle";

it("resizes by dragging the card handle", () => {
  const onResize = vi.fn();
  render(<CardResizeHandle label="拉伸连接状态卡片" size="1x1" onResize={onResize} />);
  const handle = screen.getByRole("button", { name: "拉伸连接状态卡片" });
  fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientX: 48, clientY: 48, pointerId: 1 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  expect(onResize).toHaveBeenCalledWith("2x2");
});
```

- [ ] **Step 3: Run tests to verify failure**

```powershell
npm.cmd run test:unit -- src/components/cards/directCardLayout.test.tsx src/features/dashboard/DashboardPage.test.tsx
```

Expected: FAIL because current dashboard still uses explicit edit button and separate editor panel.

- [ ] **Step 4: Refactor card grid to direct manipulation**

Dashboard and monitor card grids should:

- Render visible cards directly in the grid.
- Attach dnd-kit drag listeners to card headers.
- Show a small icon-only drag affordance and corner resize handle on hover/focus.
- Save layout changes immediately through `saveLayout(username, page, nextLayout)` with no visible save/cancel step.
- Keep `resetLayout` only in Settings > Appearance.

- [ ] **Step 5: Update accessible labels**

Use icon-only controls with labels:

```tsx
aria-label={`移动${cardLabel}卡片`}
aria-label={`拉伸${cardLabel}卡片`}
```

Do not render visible text `调整布局`, `编辑布局`, `保存布局`, or `取消` in card layout areas.

- [ ] **Step 6: Verify and commit**

```powershell
npm.cmd run test:unit -- src/components/cards src/features/dashboard/DashboardPage.test.tsx src/features/device-workspace/DeviceWorkspacePage.test.tsx
npm.cmd run test:layout-regressions
npm.cmd run build
git add src/components/cards src/features/dashboard src/features/device-workspace
git commit -m "refactor: make cards directly draggable and resizable"
```

### Task 6: Remove Large Blank Areas With Fill Rules And Strong Empty States

**Files:**
- Modify: `src/components/data/EmptyState.tsx`
- Modify: `src/components/data/data.css`
- Modify: `src/components/data/data-components.test.tsx`
- Modify: `src/features/dashboard/dashboard.css`
- Modify: `src/features/device-workspace/deviceWorkspace.css`
- Modify: `src/features/sessions/sessions.css`
- Modify: `src/features/logs/logs.css`
- Modify: `src/features/settings/settings.css`
- Modify: `scripts/verify-layout-regressions.mjs`

**Interfaces:**
- Produces:

```ts
export interface EmptyStateProps {
  title: string;
  reason: string;
  context?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ size?: number }>;
  density?: "compact" | "comfortable" | "fill";
}
```

- [ ] **Step 1: Write failing empty-state fill test**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";

it("supports a fill density for empty primary regions", () => {
  render(
    <EmptyState
      title="暂无录制会话"
      reason="尚未开始录制"
      context="保存目录：D:\\APP\\ControlUI\\data"
      density="fill"
      action={<button>开始录制</button>}
    />,
  );
  expect(screen.getByText("暂无录制会话")).toHaveClass("empty-state-title");
});
```

- [ ] **Step 2: Run test to verify failure**

```powershell
npm.cmd run test:unit -- src/components/data/data-components.test.tsx
```

Expected: FAIL because `density` is not implemented.

- [ ] **Step 3: Implement empty-state densities**

```tsx
<div className={`empty-state empty-state-${density ?? "comfortable"}`}>
```

```css
.empty-state-compact { min-height: 120px; }
.empty-state-comfortable { min-height: 280px; }
.empty-state-fill { min-height: 100%; height: 100%; }
```

- [ ] **Step 4: Apply fill rules to major pages**

Use these layout rules:

- Dashboard card grid: `grid-auto-rows: minmax(150px, 1fr)` and `align-content: stretch`.
- Sessions history: empty state fills the right region and includes save path + start recording.
- Logs empty state: fills table area and includes selected filters + clear search action.
- Settings category: content uses width and vertical space without nested blank card stacks.
- Device workspace panes: each tab fills the work area; no fixed-height panel should leave a dead lower half.

- [ ] **Step 5: Add static regression checks**

```js
assert.match(dataCss, /\.empty-state-fill[\s\S]*height:\s*100%/);
assert.match(dashboardCss, /\.feature-card-grid[\s\S]*align-content:\s*stretch/);
assert.doesNotMatch(css, /grid-template-rows:\s*minmax\(92px,\s*108px\)\s*minmax\(360px,\s*1\.45fr\)\s*minmax\(214px,\s*0\.82fr\)/);
```

- [ ] **Step 6: Verify and commit**

```powershell
npm.cmd run test:unit -- src/components/data/data-components.test.tsx
npm.cmd run test:layout-regressions
npm.cmd run build
git add src/components/data src/features src/App.css scripts/verify-layout-regressions.mjs
git commit -m "fix: fill empty regions without dead space"
```

### Task 7: Remove Fragile App.css Layout Overrides

**Files:**
- Modify: `src/App.css`
- Modify: `src/styles/layouts.css`
- Modify: `src/features/dashboard/dashboard.css`
- Modify: `src/features/device-workspace/deviceWorkspace.css`
- Modify: `src/features/charts/charts.css`
- Modify: `src/features/sessions/sessions.css`
- Modify: `src/features/logs/logs.css`
- Modify: `src/features/settings/settings.css`
- Modify: `scripts/verify-layout-regressions.mjs`

**Interfaces:**
- App.css remains only for legacy shared primitives still used by old components.
- Feature-specific layout belongs in feature CSS files.

- [ ] **Step 1: Add regression checks for fragile patterns**

```js
assert.doesNotMatch(css, /\.workspace-control-grid\s+\.panel:nth-child/, "workspace layout must not depend on panel order");
assert.doesNotMatch(css, /display:\s*none\s*!important/, "layout must not hide functional controls with !important");
assert.doesNotMatch(css, /\.playback-bar\s*\{[\s\S]*display:\s*none/, "playback bar must not be globally hidden");
assert.doesNotMatch(css, /grid-template-rows:\s*minmax\([^)]+\)\s*minmax\([^)]+\)\s*minmax\([^)]+\)/, "App.css must not own fixed page row recipes");
```

- [ ] **Step 2: Run check to verify failure**

```powershell
npm.cmd run test:layout-regressions
```

Expected: FAIL because current App.css has `nth-child`, fixed row recipes and hidden playback bar.

- [ ] **Step 3: Move remaining page layout rules out of App.css**

Move only still-needed feature rules:

- Dashboard-specific rules to `src/features/dashboard/dashboard.css`.
- Device workspace rules to `src/features/device-workspace/deviceWorkspace.css`.
- Chart rules to `src/features/charts/charts.css`.
- Settings rules to `src/features/settings/settings.css`.

Delete dead or duplicate old rules instead of copying them.

- [ ] **Step 4: Replace order-dependent selectors**

Replace patterns like:

```css
.workspace-control-grid .panel:nth-child(3)
```

with semantic classes rendered by components:

```tsx
<section className="workspace-panel workspace-panel-calibration">
```

```css
.workspace-panel-calibration { ... }
```

- [ ] **Step 5: Restore playback control visibility**

Remove:

```css
.playback-bar {
  display: none !important;
}
```

Use one of these explicit strategies:

- Global playback bar visible when playback belongs to current device.
- In-page playback controls visible in Playback tab.
- If both exist, global bar becomes compact and never overlays content.

- [ ] **Step 6: Verify and commit**

```powershell
npm.cmd run test:layout-regressions
npm.cmd run test:unit
npm.cmd run build
git add src/App.css src/features src/styles scripts/verify-layout-regressions.mjs
git commit -m "refactor: remove fragile layout overrides"
```

### Task 8: Add Real Visual Smoke Verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `scripts/verify-visual-smoke.mjs`
- Create: `src/test/visualRoutes.ts` if route fixture helpers are needed.
- Modify: `.gitignore` to ignore `artifacts/visual-smoke/`.

**Interfaces:**
- Produces script:

```powershell
npm.cmd run test:visual-smoke
```

- Script starts Vite on port `1421` if free, opens Chromium, captures screenshots, and fails on console errors or obvious layout defects.

- [ ] **Step 1: Install Playwright test dependency**

```powershell
npm.cmd install --save-dev @playwright/test
npx.cmd playwright install chromium
```

If network fails, document blocker and keep this task open.

- [ ] **Step 2: Add script**

In `package.json`:

```json
"test:visual-smoke": "node scripts/verify-visual-smoke.mjs"
```

- [ ] **Step 3: Create visual smoke script**

The script must:

```js
const routes = ["/#/dashboard", "/#/workspace", "/#/charts", "/#/sessions", "/#/logs", "/#/settings"];
const viewports = [
  { width: 1600, height: 980, name: "desktop" },
  { width: 1280, height: 800, name: "min-desktop" },
];
const themes = ["light", "dark"];
```

For each route/theme/viewport:

- Navigate to `http://127.0.0.1:1421${route}`.
- Set `localStorage` theme preference.
- Wait for `.app-shell` or `.login-shell`.
- Capture screenshot to `artifacts/visual-smoke/`.
- Fail if console has `error`.
- Fail if any visible element with text has bounding box width or height `0`.
- Fail if body scroll height exceeds viewport height by more than 2 px.
- Fail if visible text contains mojibake denylist.
- Fail if `.app-content` has visible vertical scrollbar.

- [ ] **Step 4: Add route-specific checks**

```js
await expectVisible(page, ".app-sidebar");
await expectVisible(page, ".global-status-bar");
await expectNoText(page, /调整布局|编辑布局/);
await expectNoText(page, /涓|鏃|鐧|璁|鎬|浼|绾|鍘|褰|榧/);
```

For charts:

```js
await expectVisible(page, ".charts-sidebar");
await expectVisible(page, ".chart-canvas-region");
```

For sessions:

```js
await expectVisible(page, ".recorder-workbench");
await expectVisible(page, ".sessions-page-content");
```

For settings:

```js
await expectVisible(page, ".settings-navigation-tabs");
await expectVisible(page, ".settings-section");
```

- [ ] **Step 5: Run visual smoke**

```powershell
npm.cmd run test:visual-smoke
```

Expected: PASS and screenshots saved under `artifacts/visual-smoke`.

- [ ] **Step 6: Verify and commit**

```powershell
npm.cmd run test:visual-smoke
npm.cmd run test:unit
npm.cmd run test:layout-regressions
npm.cmd run build
git add package.json package-lock.json scripts/verify-visual-smoke.mjs .gitignore
git commit -m "test: add visual smoke layout verification"
```

### Task 9: Final Desktop Build And Acceptance Record

**Files:**
- Modify: `docs/development-status.md`
- Create: `docs/appearance-layout-acceptance-report.md`

**Interfaces:**
- Produces final acceptance report with exact test commands, screenshot artifact paths, known residual risks and current completion estimate.

- [ ] **Step 1: Clean previous SoftUI-owned runtime**

```powershell
$softuiProcesses = Get-Process | Where-Object {
  $_.Path -like '*softui-desktop*' -or $_.ProcessName -eq 'softui-desktop'
}
$softuiProcesses | Stop-Process -Force
$listeners = Get-NetTCPConnection -State Listen -LocalPort 1421 -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
  $proc = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue
  if ($proc -and $proc.Path -like '*softui-desktop*') { Stop-Process -Id $proc.Id -Force }
}
```

Do not stop unrelated services such as local proxy `7892`.

- [ ] **Step 2: Run full verification**

```powershell
npm.cmd run test:unit
npm.cmd run test:ui-regressions
npm.cmd run test:layout-regressions
npm.cmd run test:visual-smoke
npm.cmd run build
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

- [ ] **Step 3: Build release exe**

```powershell
npm.cmd run tauri -- build
```

Expected outputs:

```text
src-tauri\target\release\softui-desktop.exe
src-tauri\target\release\bundle\nsis\softui-desktop_0.1.0_x64-setup.exe
src-tauri\target\release\bundle\msi\softui-desktop_0.1.0_x64_en-US.msi
```

- [ ] **Step 4: Write acceptance report**

Create `docs/appearance-layout-acceptance-report.md` with:

```md
# 外观布局验收报告

## 修复范围
- 中文文案可读性
- 浅色/深色主题按钮对比
- 无可见垂直滚动条
- 响应式功能可达
- 直接拖拽/拉伸卡片
- 大面积空白收口
- 真实截图验收

## 验证命令
[paste exact pass results]

## 截图产物
[list artifacts/visual-smoke files]

## 当前完成度
- 外观布局重构：目标提升到 90%
- 可视化验收与细节打磨：目标提升到 80%

## 残余风险
[only real remaining risks]
```

- [ ] **Step 5: Update progress doc**

Update `docs/development-status.md` HEAD and completion estimates.

- [ ] **Step 6: Commit**

```powershell
git add docs/development-status.md docs/appearance-layout-acceptance-report.md
git commit -m "docs: record appearance layout acceptance"
```

## Phase Verification

The phase is complete only when all commands pass:

```powershell
npm.cmd run test:unit
npm.cmd run test:ui-regressions
npm.cmd run test:layout-regressions
npm.cmd run test:visual-smoke
npm.cmd run build
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
git status --short
```

Expected:

- All commands exit `0`.
- No source file contains visible mojibake.
- No visible text button says `调整布局` or `编辑布局`.
- No layout critical region is hidden with `display: none`.
- No `.playback-bar` is globally hidden.
- Chart channels, recorder controls and settings navigation remain reachable at `1280x800`.
- App shell has no visible vertical scrollbar.
- Screenshot artifacts exist for dashboard, workspace, charts, sessions, logs and settings in both light and dark theme.

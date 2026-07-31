# Layout And Appearance Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复布局与外观评估中列出的全部问题：统一侧栏配色、禁止自动缩回、去除可见垂直滚动条、修复曲线勾选项裁剪、卡片改为拖拽调整大小，并清理旧样式。

**Architecture:** 外壳层先统一 token 与固定宽度；滚动策略改为“页面不滚动、内部滚动但不显示滚动条”；曲线通道样式迁移到 feature CSS；卡片布局使用指针拖拽调整离散尺寸；最后删除 App.css 死代码。

**Tech Stack:** React 19, TypeScript, CSS token, Vitest, dnd-kit, Vite, Tauri.

## Global Constraints

- 布局调整不再出现尺寸选择按钮，只允许拖拽卡片或拖拽调整大小。
- 侧边栏不随窗口宽度自动缩回。
- 页面框架不出现可见垂直滚动条。
- 曲线通道勾选项必须完整可见。
- 普通冲突按最合理工程选择处理，不打断用户确认。

---

### Task 1: Unify Sidebar Theme And Disable Auto Collapse

**Files:**
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/shell.css`
- Modify: `scripts/verify-layout-regressions.mjs`

**Interfaces:**
- Produces updated `--surface-sidebar`, `--text-sidebar`, `--text-sidebar-muted` values.

- [ ] **Step 1: Update light and dark sidebar tokens**

```css
:root, :root[data-theme="light"] {
  --surface-sidebar: #e4eaf0;
  --text-sidebar: #213241;
  --text-sidebar-muted: #5c6d7b;
}

:root[data-theme="dark"] {
  --surface-sidebar: #1b242b;
  --text-sidebar: #e5edf3;
  --text-sidebar-muted: #a5b2bd;
}
```

- [ ] **Step 2: Remove sidebar collapse media query**

Delete the `@media (max-width: 1439px)` block in `src/styles/shell.css` that hides sidebar labels and changes `grid-template-columns` to 72px. Keep `.app-shell { grid-template-columns: 224px minmax(0, 1fr); }` at all widths.

- [ ] **Step 3: Update active nav state**

```css
.sidebar-nav-link:hover,
.sidebar-nav-link.is-active {
  border-color: var(--border-default);
  background: var(--surface-page);
  color: var(--text-primary);
}
```

- [ ] **Step 4: Update static regression checks**

In `scripts/verify-layout-regressions.mjs`:

```js
assert.match(shell, /grid-template-columns: 224px/);
assert.doesNotMatch(shell, /@media \(max-width: 1439px\)/);
```

- [ ] **Step 5: Run checks and commit**

```powershell
node scripts/verify-layout-regressions.mjs
npm.cmd run build
git add src/styles/tokens.css src/styles/shell.css scripts/verify-layout-regressions.mjs
git commit -m "fix: unify sidebar theme and keep sidebar fixed"
```

### Task 2: Remove Visible Vertical Scrollbars

**Files:**
- Modify: `src/styles/shell.css`
- Modify: `src/styles/base.css`
- Modify: `scripts/verify-layout-regressions.mjs`

- [ ] **Step 1: Hide scrollbars globally**

```css
html,
body {
  scrollbar-width: none;
}

*::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 2: Make app page content non-scrolling**

```css
.app-page-content {
  min-height: 0;
  overflow: hidden;
}
```

- [ ] **Step 3: Keep internal overflow for tables and charts**

Keep `overflow: auto` on `.layout-scroll-region`, `.sessions-table-region`, `.logs-table-region`, and `.charts-sidebar`. Visible bars are hidden by Step 1 while mouse wheel and touch scrolling still work.

- [ ] **Step 4: Add regression assertions**

```js
assert.match(shell, /scrollbar-width:\s*none/);
assert.match(shell, /\.app-page-content[\s\S]*overflow:\s*hidden/);
```

- [ ] **Step 5: Run checks and commit**

```powershell
node scripts/verify-layout-regressions.mjs
npm.cmd run build
git add src/styles/shell.css src/styles/base.css scripts/verify-layout-regressions.mjs
git commit -m "fix: remove visible vertical scrollbars"
```

### Task 3: Fix Chart Channel Checkbox Clipping

**Files:**
- Modify: `src/features/charts/charts.css`
- Modify: `scripts/verify-layout-regressions.mjs`

- [ ] **Step 1: Add channel sizing overrides**

```css
.chart-layout .channel-items {
  min-width: 0;
}

.chart-layout .channel-item {
  min-width: 0;
}

.chart-layout .channel-item input[type="checkbox"] {
  flex-shrink: 0;
}

.chart-layout .channel-name {
  flex: 1 1 auto;
}

.chart-layout .channel-unit {
  flex-shrink: 0;
}

.chart-layout .charts-sidebar {
  overflow-x: hidden;
}
```

- [ ] **Step 2: Add regression assertion**

```js
assert.match(chartsCss, /\.channel-item\s*\{[\s\S]*min-width:\s*0/);
```

`chartsCss` is read from `src/features/charts/charts.css` in `scripts/verify-layout-regressions.mjs`.

- [ ] **Step 3: Run checks and commit**

```powershell
node scripts/verify-layout-regressions.mjs
npm.cmd run build
git add src/features/charts/charts.css scripts/verify-layout-regressions.mjs
git commit -m "fix: keep chart channel checkboxes fully visible"
```

### Task 4: Drag Cards To Resize

**Files:**
- Create: `src/components/cards/cardResize.ts`
- Create: `src/components/cards/cardResize.test.ts`
- Create: `src/components/cards/CardResizeHandle.tsx`
- Modify: `src/components/cards/CardLayoutEditor.tsx`
- Modify: `src/components/cards/cards.css`
- Modify: `src/components/cards/CardLayoutEditor.test.tsx`
- Modify: `src/features/device-workspace/DeviceWorkspacePage.test.tsx`

**Interfaces:**
- Produces `sizeFromDrag(start: CardSize, dx: number, dy: number): CardSize`.

- [ ] **Step 1: Write failing pure size test**

```ts
it("maps drag direction to the next discrete size", () => {
  expect(sizeFromDrag("1x1", 40, 20)).toBe("2x1");
  expect(sizeFromDrag("1x1", 20, 40)).toBe("1x2");
  expect(sizeFromDrag("1x1", 40, 40)).toBe("2x2");
  expect(sizeFromDrag("2x2", -40, -40)).toBe("1x1");
});
```

- [ ] **Step 2: Implement `sizeFromDrag`**

```ts
const THRESHOLD = 24;

export function sizeFromDrag(start: CardSize, dx: number, dy: number): CardSize {
  const wide = dx >= THRESHOLD;
  const tall = dy >= THRESHOLD;
  const shrinkWide = dx <= -THRESHOLD;
  const shrinkTall = dy <= -THRESHOLD;

  if (wide && tall) return "2x2";
  if (wide) return "2x1";
  if (tall) return "1x2";
  if (shrinkWide && shrinkTall) return "1x1";
  if (shrinkWide) return start.includes("2") ? "1x1" : start;
  if (shrinkTall) return start.includes("2") ? "1x1" : start;
  return start;
}
```

- [ ] **Step 3: Add `CardResizeHandle`**

```tsx
export function CardResizeHandle({ size, onResize, label }: CardResizeHandleProps) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    startRef.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!startRef.current) return;
    const dx = event.clientX - startRef.current.x;
    const dy = event.clientY - startRef.current.y;
    if (Math.abs(dx) > 24 || Math.abs(dy) > 24) {
      onResize(sizeFromDrag(size, dx, dy));
    }
  };

  const onPointerUp = () => {
    startRef.current = null;
  };

  return (
    <button
      aria-label={label}
      className="card-resize-handle"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      type="button"
    >
      <Maximize2 size={14} />
    </button>
  );
}
```

- [ ] **Step 4: Remove `CardSizeMenu` from editor**

Replace the `CardSizeMenu` in each card title with `<CardResizeHandle size={card.size} onResize={(size) => updateSize(card.id, size)} label={`调整${cardLabel}卡片大小`} />`.

- [ ] **Step 5: Update tests**

Remove the two tests that assert size option buttons. Add a test that renders the editor and asserts `queryByRole("button", { name: "调整连接状态卡片大小" })` exists and `queryByRole("list", { name: "连接状态卡片尺寸" })` does not exist.

Update `DeviceWorkspacePage.test.tsx` to use the resize handle instead of clicking size menu buttons.

- [ ] **Step 6: Run tests and build**

```powershell
.\node_modules\.bin\vitest.cmd run src/components/cards src/features/device-workspace
npm.cmd run build
```

- [ ] **Step 7: Commit**

```powershell
git add src/components/cards src/features/device-workspace/DeviceWorkspacePage.test.tsx
git commit -m "feat: resize cards by dragging instead of buttons"
```

### Task 5: Remove Duplicate Top Navigation

**Files:**
- Modify: `src/app/AppShell.tsx`
- Modify: `src/styles/shell.css`
- Modify: `src/app/AppShell.test.tsx`
- Modify: `scripts/verify-layout-regressions.mjs`

- [ ] **Step 1: Remove `PageTabs` from `AppShell`**

Delete `<PageTabs />` and the `PageTabs` import. Keep `SidebarNav` as the only navigation surface.

- [ ] **Step 2: Remove the tab row**

```css
.app-content {
  min-height: 0;
  overflow: hidden;
}
```

Remove `.app-content { grid-template-rows: 40px minmax(0, 1fr); }` and the `.page-tabs`, `.page-tab` rules if no longer used elsewhere.

- [ ] **Step 3: Update tests**

Update `AppShell.test.tsx` to stop querying `PageTabs`. Add assertion that the shell has no `page-tabs` element.

- [ ] **Step 4: Update regression script**

```js
assert.doesNotMatch(shell, /\.page-tabs/);
```

- [ ] **Step 5: Run checks and commit**

```powershell
node scripts/verify-layout-regressions.mjs
npm.cmd run build
git add src/app/AppShell.tsx src/app/AppShell.test.tsx src/styles/shell.css scripts/verify-layout-regressions.mjs
git commit -m "refactor: keep sidebar as the only navigation"
```

### Task 6: Fix Settings Whitespace And Dashboard Density

**Files:**
- Modify: `src/features/settings/settings.css`
- Modify: `src/features/dashboard/dashboard.css`
- Modify: `scripts/verify-layout-regressions.mjs`

- [ ] **Step 1: Allow settings content to fill the main area**

```css
.settings-section {
  max-width: none;
}
```

- [ ] **Step 2: Let dashboard cards adapt to content**

```css
.feature-card-grid {
  grid-auto-rows: minmax(150px, auto);
}
```

- [ ] **Step 3: Add regression assertions**

```js
assert.match(settingsCss, /\.settings-section\s*\{[\s\S]*max-width:\s*none/);
assert.match(dashboardCss, /grid-auto-rows:\s*minmax\(150px,\s*auto\)/);
```

`settingsCss` and `dashboardCss` are read from the corresponding feature CSS files.

- [ ] **Step 4: Run checks and commit**

```powershell
node scripts/verify-layout-regressions.mjs
npm.cmd run build
git add src/features/settings/settings.css src/features/dashboard/dashboard.css scripts/verify-layout-regressions.mjs
git commit -m "style: reduce settings whitespace and dashboard density gaps"
```

### Task 7: Clean Legacy App.css

**Files:**
- Modify: `src/App.css`
- Modify: `scripts/verify-layout-regressions.mjs`

- [ ] **Step 1: Delete dead page selectors**

Remove these blocks after confirming the feature pages no longer reference them:

- `.charts-page-layout` and related `.charts-sidebar` legacy rules after Task 3 migration
- `.sessions-page-layout`, `.sessions-workbench`, `.sessions-main`
- `.logs-page-layout`, `.log-filter-bar`
- `.settings-grid`, `.settings-grid .panel:nth-child(...)`

- [ ] **Step 2: Unify shared radius**

Change `.panel`, `.ghost-btn`, `.primary-btn`, `.ghost-btn-sm` from `8px` to `var(--radius-card)`.

- [ ] **Step 3: Replace remaining hard-coded colors for active shared components with tokens**

Focus on `.panel`, `.log-row`, `.charts-sidebar`, `.charts-toolbar`, `.charts-readout`, `.channel-item`, and `.status-strip`.

- [ ] **Step 4: Update regression script**

```js
assert.doesNotMatch(css, /\.settings-grid/);
assert.doesNotMatch(css, /\.logs-page-layout/);
assert.doesNotMatch(css, /\.sessions-page-layout/);
```

- [ ] **Step 5: Run full checks and commit**

```powershell
npm.cmd run test:unit
npm.cmd run test:ui-regressions
npm.cmd run test:layout-regressions
npm.cmd run build
git add src/App.css scripts/verify-layout-regressions.mjs
git commit -m "chore: remove legacy page layout css"
```

### Task 8: Final Verification And Docs

- [ ] **Step 1: Run full verification**

```powershell
npm.cmd run test:unit
npm.cmd run test:ui-regressions
npm.cmd run test:layout-regressions
npm.cmd run build
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

Expected: all exit `0`.

- [ ] **Step 2: Build release exe**

```powershell
npm.cmd run tauri -- build
```

- [ ] **Step 3: Update `docs/development-status.md` and commit**

```powershell
git add docs/development-status.md
git commit -m "docs: record layout and appearance fix completion"
```

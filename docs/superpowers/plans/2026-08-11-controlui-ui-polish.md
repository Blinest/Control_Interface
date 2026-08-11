# ControlUI UI Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the ControlUI upper-computer interface from a functional engineering UI into a denser, clearer, more professional operator interface, with special focus on dashboard layout, chart readability, channel navigation, and status semantics.

**Architecture:** Keep the existing React/Tauri architecture and current page structure. Treat this as a focused UI refinement pass: improve presentational components, CSS layout rules, and regression coverage without changing Rust runtime behavior or copying from sibling projects.

**Tech Stack:** React 19, TypeScript, Vite, Tauri 2, uPlot, Vitest, Testing Library, Playwright visual smoke scripts.

## Global Constraints

- Work only in `D:\LuckyStar\Desktop\研究生工作\2025-2026研一下\绳驱连续体机器人\ControlUI`.
- Do not use, launch, copy from, or validate against sibling projects such as `ThreeSoft`.
- Keep edits tightly scoped to layout, appearance, and chart interaction refinements.
- Preserve Tauri port `1421` ownership rules when running the desktop app.
- Run `npm run test:unit`, `npm run test:layout-regressions`, `npm run build`, `npm run test:visual-smoke`, and `npm run tauri -- build` before declaring implementation complete.
- Favor small CSS/component changes over a full redesign.

---

## File Structure

- Modify `src/features/charts/ChartsPage.tsx`: extract chart option construction and improve axis/readout behavior.
- Modify `src/features/charts/ChannelSidebar.tsx`: add channel search/filtering and assignment indicators.
- Modify `src/features/charts/charts.css`: tune chart grid, axis spacing, channel list density, and toolbar wrapping.
- Modify `src/features/charts/ChartsPage.test.tsx`: add regression tests for multi-series labels, axis grouping, and channel filtering.
- Modify `src/features/dashboard/DashboardPage.tsx`: preserve layout model while improving dashboard card placement.
- Modify `src/features/dashboard/dashboardCards.tsx`: make status and health cards more compact and diagnostic.
- Modify `src/features/dashboard/dashboard.css`: reduce empty card space and standardize card rhythm.
- Modify `src/components/layout/GlobalStatusBar.tsx`: expose structured status severity classes.
- Modify `src/styles/shell.css`: refine top bar status chips and sidebar collapsed states.
- Modify `scripts/verify-layout-regressions.mjs`: add checks for dashboard density and chart rail usability.
- Modify `scripts/verify-visual-smoke.mjs`: ensure screenshots cover grouped chart assignments and collapsed rails.

---

### Task 1: Chart Axis And Plot Readability

**Files:**
- Modify: `src/features/charts/ChartsPage.tsx`
- Modify: `src/features/charts/charts.css`
- Test: `src/features/charts/ChartsPage.test.tsx`

**Interfaces:**
- Consumes: `resolveSubplotChannels(assignment: string, channels: ChannelMeta[]): ChannelMeta[]`
- Produces: `buildSeriesAxes(channels: ChannelMeta[]): { scales: Record<string, uPlot.Scale>; series: uPlot.Series[]; axes: uPlot.Axis[] }`

- [ ] **Step 1: Write failing tests for multi-unit axes**

Add tests to `src/features/charts/ChartsPage.test.tsx`:

```tsx
it("creates one y axis per unit when one subplot contains mixed motor parameters", async () => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  render(<ChartsPage snapshot={makeMotorParameterSnapshot()} currentDeviceId="softui-sim-01" />);

  const firstAssignment = screen.getAllByRole("combobox", { name: /子图 \d 曲线/ })[0];
  await userEvent.selectOptions(firstAssignment, "motor:1:all");

  const firstRecreatedPlot = uplotMockState.instances[uplotMockState.instances.length - 6];
  expect(firstRecreatedPlot?.options.axes.slice(1).map((axis) => axis.label)).toEqual(["mm", "mm/s", "mm/s²"]);
});
```

- [ ] **Step 2: Run the chart test and verify it fails**

Run: `npm run test:unit -- src/features/charts/ChartsPage.test.tsx`

Expected: FAIL because the current mock type does not expose axis labels or because axis generation is still inline.

- [ ] **Step 3: Extract chart axis construction**

In `src/features/charts/ChartsPage.tsx`, add:

```ts
function buildSeriesAxes(subplotChannels: ChannelMeta[]) {
  const scaleKeys = Array.from(new Set(subplotChannels.map(channelScaleKey)));
  return {
    scales: Object.fromEntries(scaleKeys.map((scaleKey) => [scaleKey, {}])),
    series: subplotChannels.map((channel) => ({
      label: channel.name,
      scale: channelScaleKey(channel),
      stroke: channel.color,
      width: 1.5,
      points: { show: false },
    })) as uPlot.Series[],
    axes: scaleKeys.map((scaleKey, index) => ({
      label: scaleKey,
      scale: scaleKey,
      stroke: "#888",
      grid: { stroke: index === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0)" },
      side: 1 as const,
      size: 44,
    })) as uPlot.Axis[],
  };
}
```

Then replace the inline `scaleKeys`, `series`, and y-axis construction with the helper output.

- [ ] **Step 4: Improve chart spacing CSS**

In `src/features/charts/charts.css`, add:

```css
.chart-subplot-canvas {
  min-width: 0;
  overflow: hidden;
}

.chart-subplot .u-axis {
  font-size: 11px;
}

.chart-subplot-header strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 5: Verify**

Run:

```powershell
npm run test:unit -- src/features/charts/ChartsPage.test.tsx
npm run build
```

Expected: both commands exit 0.

---

### Task 2: Channel Rail Search And Assignment Awareness

**Files:**
- Modify: `src/features/charts/ChannelSidebar.tsx`
- Modify: `src/features/charts/charts.css`
- Test: `src/features/charts/ChartsPage.test.tsx`

**Interfaces:**
- Consumes: `subplotAssignments: string[]`, `subplotOptions: SubplotOption[]`
- Produces: visible channel filtering and `data-assigned-subplots="1,3"` markers on channel rows.

- [ ] **Step 1: Write failing tests for filtering and assignment markers**

Add to `ChartsPage.test.tsx`:

```tsx
it("filters the channel library without removing subplot assignment controls", async () => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  render(<ChartsPage snapshot={makeMotorParameterSnapshot()} currentDeviceId="softui-sim-01" />);

  await userEvent.type(screen.getByRole("searchbox", { name: "过滤通道" }), "Motor 2 vel");

  expect(screen.getByRole("combobox", { name: "子图 1 曲线" })).toBeVisible();
  expect(screen.getByText("Motor 2 vel")).toBeVisible();
  expect(screen.queryByText("Motor 1 acc")).not.toBeInTheDocument();
});

it("marks channel rows that are already assigned to a subplot", () => {
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  render(<ChartsPage snapshot={makeMotorParameterSnapshot()} currentDeviceId="softui-sim-01" />);

  expect(screen.getByText("Motor 1 pos").closest(".channel-item")).toHaveAttribute("data-assigned-subplots", "1");
});
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npm run test:unit -- src/features/charts/ChartsPage.test.tsx`

Expected: FAIL because no searchbox or assignment marker exists.

- [ ] **Step 3: Add filtering state to `ChannelSidebar`**

In `ChannelSidebar.tsx`, import `useMemo` and `useState`, add:

```tsx
const [query, setQuery] = useState("");
const normalizedQuery = query.trim().toLowerCase();
const filteredChannels = useMemo(
  () => channels.filter((channel) => (
    normalizedQuery.length === 0
      || channel.name.toLowerCase().includes(normalizedQuery)
      || channel.unit.toLowerCase().includes(normalizedQuery)
  )),
  [channels, normalizedQuery],
);
```

Render above the group list:

```tsx
<input
  aria-label="过滤通道"
  className="channel-filter"
  type="search"
  value={query}
  onChange={(event) => setQuery(event.target.value)}
  placeholder="搜索通道或单位"
/>
```

- [ ] **Step 4: Add assignment marker helper**

In `ChannelSidebar.tsx`, add:

```tsx
function assignedSubplotsForChannel(channelName: string, subplotAssignments: string[]) {
  return subplotAssignments
    .map((assignment, index) => (assignment === `channel:${channelName}` || assignment === channelName ? index + 1 : null))
    .filter((index): index is number => index !== null);
}
```

Use it on each channel row:

```tsx
const assignedSubplots = assignedSubplotsForChannel(channel.name, subplotAssignments);
```

```tsx
<div
  className={`channel-item${assignedSubplots.length > 0 ? " is-assigned" : ""}`}
  data-assigned-subplots={assignedSubplots.join(",") || undefined}
  key={channel.name}
>
```

Render a compact badge:

```tsx
{assignedSubplots.length > 0 ? <span className="channel-assignment">子图 {assignedSubplots.join(",")}</span> : null}
```

- [ ] **Step 5: Style channel filtering and assignment badges**

In `charts.css`, add:

```css
.channel-filter {
  width: 100%;
  height: 28px;
  border: 1px solid var(--border-default);
  border-radius: var(--radius-card);
  background: var(--surface-page);
  color: var(--text-primary);
  padding: 0 8px;
  font-size: 12px;
}

.channel-item.is-assigned {
  background: var(--surface-muted);
}

.channel-assignment {
  flex: 0 0 auto;
  color: var(--text-secondary);
  font-size: 11px;
}
```

- [ ] **Step 6: Verify**

Run:

```powershell
npm run test:unit -- src/features/charts/ChartsPage.test.tsx
npm run test:visual-smoke
```

Expected: tests pass and chart screenshots still show usable left rail.

---

### Task 3: Dashboard Density And Card Rhythm

**Files:**
- Modify: `src/features/dashboard/DashboardPage.tsx`
- Modify: `src/features/dashboard/dashboardCards.tsx`
- Modify: `src/features/dashboard/dashboard.css`
- Test: `src/features/dashboard/DashboardPage.test.tsx`
- Test: `scripts/verify-layout-regressions.mjs`

**Interfaces:**
- Consumes: `dashboardCardRegistry`
- Produces: compact card body variants using existing `DashboardCardDefinition.render(context)`

- [ ] **Step 1: Write layout regression check for excessive blank space**

In `scripts/verify-layout-regressions.mjs`, add a check that rejects dashboard cards taller than 300px when they contain fewer than 4 metric cells:

```js
const dashboardCss = readFileSync("src/features/dashboard/dashboard.css", "utf8");
assert(
  /grid-auto-rows:\s*minmax\(120px,\s*auto\)/.test(dashboardCss),
  "dashboard cards should use compact auto rows instead of fixed tall rows",
);
```

- [ ] **Step 2: Run the layout test and confirm failure**

Run: `npm run test:layout-regressions`

Expected: FAIL if the dashboard still uses tall fixed rows.

- [ ] **Step 3: Reduce default card height**

In `dashboard.css`, change `.feature-card-grid` and `.feature-card` rhythm:

```css
.feature-card-grid {
  grid-auto-rows: minmax(120px, auto);
  gap: 12px;
}

.feature-card {
  min-height: 0;
}

.feature-card-body {
  align-content: start;
}
```

- [ ] **Step 4: Make sparse cards compact**

In `dashboardCards.tsx`, keep `Metric` but make recording and alerts use tighter structures:

```tsx
<div className="feature-card-primary-state compact">
  <span className="status-pill muted">未记录</span>
  <strong>当前设备尚未开始会话</strong>
  <span>{recorderStatus.frames} 帧 · {recorderStatus.elapsedSeconds.toFixed(1)} 秒</span>
</div>
```

- [ ] **Step 5: Add CSS for compact state blocks**

In `dashboard.css`, add:

```css
.feature-card-primary-state.compact {
  align-items: flex-start;
  justify-content: center;
  min-height: 78px;
}

.feature-card-primary-state.compact strong {
  font-size: 15px;
}
```

- [ ] **Step 6: Verify dashboard screenshots**

Run:

```powershell
npm run test:unit -- src/features/dashboard/DashboardPage.test.tsx
npm run test:layout-regressions
npm run test:visual-smoke
```

Expected: tests pass; dashboard screenshots show less empty vertical space without overlap.

---

### Task 4: Status Semantics In Header And Cards

**Files:**
- Modify: `src/components/layout/GlobalStatusBar.tsx`
- Modify: `src/styles/shell.css`
- Modify: `src/features/dashboard/dashboardCards.tsx`
- Test: `src/app/AppShell.test.tsx`
- Test: `src/styles/tokens.test.ts`

**Interfaces:**
- Produces: `.status-chip.is-ok`, `.status-chip.is-muted`, `.status-chip.is-warning`, `.status-chip.is-danger`

- [ ] **Step 1: Write status chip tests**

In `src/app/AppShell.test.tsx`, assert stable semantic classes:

```tsx
expect(screen.getByText("ready").closest(".status-chip")).toHaveClass("is-ok");
expect(screen.getByText("未使能").closest(".status-chip")).toHaveClass("is-muted");
expect(screen.getByText("未录制").closest(".status-chip")).toHaveClass("is-muted");
```

- [ ] **Step 2: Run test and confirm failure**

Run: `npm run test:unit -- src/app/AppShell.test.tsx`

Expected: FAIL because semantic status classes are not assigned consistently.

- [ ] **Step 3: Add severity mapping**

In `GlobalStatusBar.tsx`, add:

```ts
type StatusSeverity = "ok" | "muted" | "warning" | "danger";

function statusSeverity(label: string): StatusSeverity {
  if (["ready", "正常", "已使能", "enabled"].includes(label)) return "ok";
  if (["未使能", "未录制", "ready"].includes(label)) return "muted";
  if (label.includes("等待") || label.includes("warning")) return "warning";
  if (label.includes("故障") || label.includes("error") || label.includes("急停")) return "danger";
  return "muted";
}
```

Apply class:

```tsx
<span className={`status-chip is-${statusSeverity(item.value)}`}>{item.value}</span>
```

- [ ] **Step 4: Style semantic chips**

In `shell.css`, add:

```css
.status-chip.is-ok {
  color: #0f7b4f;
  border-color: rgba(15, 123, 79, 0.35);
}

.status-chip.is-muted {
  color: var(--text-secondary);
}

.status-chip.is-warning {
  color: #9a6100;
  border-color: rgba(154, 97, 0, 0.35);
}

.status-chip.is-danger {
  color: var(--color-danger);
  border-color: rgba(210, 45, 58, 0.45);
}
```

- [ ] **Step 5: Verify color contrast**

Run:

```powershell
npm run test:unit -- src/app/AppShell.test.tsx src/styles/tokens.test.ts
npm run test:visual-smoke
```

Expected: tests pass; top bar statuses are distinguishable without overpowering emergency stop.

---

### Task 5: Visual Regression Coverage For The Final UI

**Files:**
- Modify: `scripts/verify-visual-smoke.mjs`
- Modify: `scripts/verify-layout-regressions.mjs`
- Test: generated screenshots in `artifacts/visual-smoke`

**Interfaces:**
- Consumes: existing visual smoke script route list.
- Produces: screenshots for dashboard, chart default, chart collapsed channel rail, grouped motor parameters, and grouped same-parameter view.

- [ ] **Step 1: Add visual states for chart grouping**

In `scripts/verify-visual-smoke.mjs`, after navigating to charts, use Playwright to select:

```js
await page.getByRole("combobox", { name: "子图 1 曲线" }).selectOption("motor:1:all");
await page.screenshot({ path: "artifacts/visual-smoke/charts-light-motor-all-desktop.png", fullPage: true });
await page.getByRole("combobox", { name: "子图 1 曲线" }).selectOption("motor-param:vel");
await page.screenshot({ path: "artifacts/visual-smoke/charts-light-all-vel-desktop.png", fullPage: true });
```

- [ ] **Step 2: Add collapsed rail screenshot**

In the same script:

```js
await page.getByRole("button", { name: "收起曲线通道" }).click();
await page.screenshot({ path: "artifacts/visual-smoke/charts-light-collapsed-rail-desktop.png", fullPage: true });
```

- [ ] **Step 3: Add layout assertions for chart axis overflow**

In `scripts/verify-layout-regressions.mjs`, add a CSS-level assertion:

```js
assert(
  /\\.chart-subplot-canvas\\s*\\{[^}]*overflow:\\s*hidden/.test(chartsCss),
  "chart subplot canvases should clip axis overflow inside the card",
);
```

- [ ] **Step 4: Verify**

Run:

```powershell
npm run test:layout-regressions
npm run test:visual-smoke
```

Expected: both commands exit 0 and screenshots include the new states.

---

### Task 6: Final Desktop Verification

**Files:**
- No source changes unless earlier tasks expose defects.

**Interfaces:**
- Consumes: all prior task outputs.
- Produces: release executable and bundled installers.

- [ ] **Step 1: Stop existing ControlUI-owned app and port 1421 server**

Run:

```powershell
$root = (Resolve-Path .).Path
Get-Process -Name softui-desktop -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$root*" } | Stop-Process -Force
Get-NetTCPConnection -LocalPort 1421 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
  if ($proc -and $proc.Path -like "$root*") { Stop-Process -Id $proc.Id -Force }
}
```

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run test:unit
npm run test:layout-regressions
npm run build
npm run test:visual-smoke
npm run tauri -- build
```

Expected: all commands exit 0.

- [ ] **Step 3: Launch the release executable**

Run:

```powershell
$exe = Join-Path (Resolve-Path .).Path "src-tauri\target\release\softui-desktop.exe"
Start-Process -FilePath $exe -WorkingDirectory (Split-Path $exe) -WindowStyle Hidden
```

- [ ] **Step 4: Confirm process path**

Run:

```powershell
Get-Process -Name softui-desktop -ErrorAction SilentlyContinue |
  Where-Object { $_.Path -like "$(Resolve-Path .)*" } |
  Select-Object Id, ProcessName, Path
```

Expected: process path starts with the current `ControlUI` workspace path.

---

## Self-Review

- Spec coverage: The plan covers chart readability, dashboard density, status semantics, channel rail usability, visual coverage, and final Tauri verification.
- Placeholder scan: No unresolved placeholder phrases or unbounded "handle edge cases" items remain.
- Type consistency: The helper names and data flow match current files: `ChannelMeta`, `subplotAssignments`, `uPlot.Options`, `dashboardCardRegistry`, and visual smoke scripts.
- Scope check: This is one coherent UI-polish pass. Runtime protocol, serial I/O, storage, and diagnostics are intentionally out of scope.

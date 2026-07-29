# Device Workbench Safety And Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 交付单一当前控制设备、统一危险操作确认、固定急停、可配置监控卡片和分标签设备工作台。

**Architecture:** 使用集中 `tauriClient` 和 `commandPolicy` 隔离 IPC 与安全交互；当前设备由独立 store 管理并在每个命令中显式传递。总览与监控卡片使用版本化布局模型和 dnd-kit 排序，控制页面采用固定模板。

**Tech Stack:** React 19, TypeScript, Tauri 2 IPC, Vitest, Testing Library, @dnd-kit/core, @dnd-kit/sortable, lucide-react.

## Global Constraints

- 可连接和监测多个设备，但同一时间只有一个当前控制设备。
- 曲线、表格、控制、录制和回放必须跟随当前设备。
- 急停固定在全局顶栏，立即执行且不弹确认框。
- 急停后全部运动控制锁定；恢复必须确认并由 Rust 最终校验。
- 当前设备、连接、使能、急停和全局故障不得成为可隐藏卡片。
- 卡片只用于总览与设备工作台监控页，尺寸仅 `1x1`、`2x1`、`1x2`、`2x2`。
- 所有 Tauri 命令必须保留明确 `deviceId`，前端状态不是安全边界。
- 不修改协议字段或重写 Rust 控制算法。

---

## File Structure

```text
src/
  services/
    tauriClient.ts
    commandPolicy.ts
  state/
    deviceSelectionStore.ts
    layoutStore.ts
  components/feedback/
    ConfirmDialog.tsx
    FaultBanner.tsx
    ToastRegion.tsx
  components/cards/
    CardLayoutEditor.tsx
    SortableCard.tsx
    CardSizeMenu.tsx
  features/dashboard/
    DashboardPage.tsx
    dashboardCards.tsx
  features/device-workspace/
    DeviceWorkspacePage.tsx
    DeviceContextPanel.tsx
    MonitorPane.tsx
    LiveDataPane.tsx
    ManualControlPane.tsx
    AutomaticControlPane.tsx
    PlaybackPane.tsx
```

### Task 1: Centralize Tauri Calls And Current Device Selection

**Files:**
- Create: `src/services/tauriClient.ts`
- Create: `src/state/deviceSelectionStore.ts`
- Create: `src/state/deviceSelectionStore.test.ts`
- Modify: `src/App.tsx:1032-1502`

**Interfaces:**
- Produces: `TauriClient`, `tauriClient`, `selectCurrentDevice`, `reconcileCurrentDevice`
- Consumes: existing command names and request shapes from `App.tsx`

- [ ] **Step 1: Write failing selection tests**

```ts
import { describe, expect, it } from "vitest";
import { reconcileCurrentDevice } from "./deviceSelectionStore";

describe("reconcileCurrentDevice", () => {
  it("keeps an available explicit selection", () => {
    expect(reconcileCurrentDevice("serial:COM4", ["serial:COM3", "serial:COM4"])).toBe("serial:COM4");
  });

  it("falls back to the first available device", () => {
    expect(reconcileCurrentDevice("serial:COM9", ["serial:COM3"])).toBe("serial:COM3");
  });

  it("returns an empty selection when no device exists", () => {
    expect(reconcileCurrentDevice("serial:COM3", [])).toBe("");
  });
});
```

Run:

```powershell
npm.cmd run test:unit -- src/state/deviceSelectionStore.test.ts
```

Expected: FAIL because the module is missing.

- [ ] **Step 2: Implement the selection rules**

```ts
export function reconcileCurrentDevice(selected: string, available: string[]): string {
  if (selected && available.includes(selected)) return selected;
  return available[0] ?? "";
}

export function selectCurrentDevice(deviceId: string): void {
  localStorage.setItem("softui:currentDeviceId", deviceId);
}
```

Read the persisted value once during controller initialization, then reconcile after every connected-device refresh.

- [ ] **Step 3: Define the IPC interface**

Create `src/services/tauriClient.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import type { RuntimeSnapshot } from "../softuiTypes";

export interface TauriClient {
  bootstrap(): Promise<RuntimeSnapshot>;
  tick(): Promise<RuntimeSnapshot>;
  submitSystemControl(deviceId: string, action: "enable" | "disable" | "emergencyStop"): Promise<RuntimeSnapshot>;
  sendMotorCommand(request: Record<string, unknown>): Promise<RuntimeSnapshot>;
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}

export const tauriClient: TauriClient = {
  bootstrap: () => invoke("bootstrap_state"),
  tick: () => invoke("tick_snapshot"),
  submitSystemControl: (deviceId, action) => invoke("submit_system_control", { request: { deviceId, action } }),
  sendMotorCommand: (request) => invoke("send_motor_command", { request }),
  invoke: (command, args) => invoke(command, args),
};
```

- [ ] **Step 4: Replace direct invokes in the controller**

Move calls from `App.tsx` behind `TauriClient`; pass `currentDeviceId` explicitly into all control requests. Do not change command names or payload field casing.

- [ ] **Step 5: Run tests and build**

```powershell
npm.cmd run test:unit -- src/state/deviceSelectionStore.test.ts
npm.cmd run build
```

Expected: both commands exit `0`.

- [ ] **Step 6: Commit**

```powershell
git add src/services/tauriClient.ts src/state/deviceSelectionStore* src/App.tsx
git commit -m "refactor: centralize IPC and current device selection"
```

### Task 2: Add Central Command Policy And Confirmation Dialog

**Files:**
- Create: `src/services/commandPolicy.ts`
- Create: `src/services/commandPolicy.test.ts`
- Create: `src/components/feedback/ConfirmDialog.tsx`
- Create: `src/components/feedback/ConfirmDialog.test.tsx`
- Create: `src/components/feedback/feedback.css`

**Interfaces:**
- Produces: `CommandKind`, `CommandConfirmation`, `buildCommandConfirmation`
- Produces: `ConfirmDialogProps`

- [ ] **Step 1: Write failing command-policy tests**

```ts
import { describe, expect, it } from "vitest";
import { buildCommandConfirmation } from "./commandPolicy";

describe("commandPolicy", () => {
  it("never confirms emergency stop", () => {
    expect(buildCommandConfirmation("emergencyStop", { deviceId: "serial:COM3" })).toBeNull();
  });

  it("shows device and parameters for motor movement", () => {
    const result = buildCommandConfirmation("motorMove", { deviceId: "serial:COM3", motorId: 2, positionMm: 12.5 });
    expect(result).toMatchObject({ level: "danger", confirmLabel: "确认发送" });
    expect(result?.details).toContain("设备：serial:COM3");
    expect(result?.details).toContain("目标位置：12.5 mm");
  });
});
```

- [ ] **Step 2: Define exact policy types**

```ts
export type CommandKind =
  | "emergencyStop" | "recover" | "enable" | "disconnect"
  | "motorMove" | "home" | "calibrate" | "bend"
  | "activeControl" | "cycleControl" | "deleteSession"
  | "resetPassword" | "changeRole" | "runMigration";

export interface CommandConfirmation {
  title: string;
  level: "warning" | "danger";
  details: string[];
  confirmLabel: string;
}

export function buildCommandConfirmation(kind: CommandKind, payload: Record<string, unknown>): CommandConfirmation | null;
```

`emergencyStop` returns `null`. Every other listed kind returns fixed Chinese copy plus concrete payload details.

- [ ] **Step 3: Write the failing dialog test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

it("requires explicit confirmation", async () => {
  const confirm = vi.fn();
  render(<ConfirmDialog open title="确认电机运动" details={["设备：serial:COM3"]} confirmLabel="确认发送" level="danger" onConfirm={confirm} onCancel={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "确认发送" }));
  expect(confirm).toHaveBeenCalledOnce();
});
```

- [ ] **Step 4: Implement accessible dialog behavior**

Use this contract:

```ts
export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  details: string[];
  confirmLabel: string;
  level: "warning" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}
```

Render `role="alertdialog"`, `aria-modal="true"`, title and detail IDs, cancel and confirm buttons. Focus confirm only for warning; focus cancel for danger.

- [ ] **Step 5: Run tests and build**

```powershell
npm.cmd run test:unit -- src/services/commandPolicy.test.ts src/components/feedback/ConfirmDialog.test.tsx
npm.cmd run build
```

Expected: both commands exit `0`.

- [ ] **Step 6: Commit**

```powershell
git add src/services/commandPolicy* src/components/feedback
git commit -m "feat: centralize dangerous command confirmations"
```

### Task 3: Enforce Immediate Emergency Stop And Confirmed Recovery

**Files:**
- Modify: `src/components/layout/GlobalStatusBar.tsx`
- Create: `src/features/device-workspace/useSafeCommand.ts`
- Create: `src/features/device-workspace/useSafeCommand.test.tsx`
- Modify: `src/App.tsx:1436-1502`
- Test: `src-tauri/src/lib.rs:3187-3436`

**Interfaces:**
- Produces: `execute(kind, payload, action)` from `useSafeCommand`
- Consumes: `buildCommandConfirmation`, `TauriClient`, current `deviceId`

- [ ] **Step 1: Write a failing emergency behavior test**

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSafeCommand } from "./useSafeCommand";

it("executes emergency stop without opening confirmation", async () => {
  const action = vi.fn().mockResolvedValue(undefined);
  const { result } = renderHook(() => useSafeCommand());
  await act(() => result.current.execute("emergencyStop", { deviceId: "serial:COM3" }, action));
  expect(action).toHaveBeenCalledOnce();
  expect(result.current.confirmation).toBeNull();
});
```

- [ ] **Step 2: Implement the safe-command hook**

The hook calls `action` immediately when policy returns `null`; otherwise stores `{ policy, action }` and runs it only after `confirm()`.

- [ ] **Step 3: Wire global emergency stop**

`GlobalStatusBar` calls `execute("emergencyStop", { deviceId }, () => tauriClient.submitSystemControl(deviceId, "emergencyStop"))`. It must never route through `ConfirmDialog`.

When `emergencyLatched` is true:

- render a persistent fault banner;
- disable all motion controls with visible reason text;
- expose `恢复控制` only when the session has `connectDevice` permission;
- route recovery through `execute("recover", { deviceId }, () => submitSystemControl(deviceId, "enable"))`.

- [ ] **Step 4: Run frontend safety tests**

```powershell
npm.cmd run test:unit -- src/features/device-workspace/useSafeCommand.test.tsx
```

Expected: emergency test and recovery-confirmation test pass.

- [ ] **Step 5: Run the existing Rust safety tests**

```powershell
cargo test --manifest-path src-tauri/Cargo.toml emergency
cargo test --manifest-path src-tauri/Cargo.toml authorized_serial_enable_allows_emergency_recovery_while_motion_stays_blocked
```

Expected: all selected Rust tests pass. If either command fails, stop this task, diagnose the failing safety invariant with `superpowers:systematic-debugging`, add a Rust regression test for that invariant, and commit the backend correction separately before continuing.

- [ ] **Step 6: Commit**

```powershell
git add src/components/layout/GlobalStatusBar.tsx src/features/device-workspace src/App.tsx
git commit -m "feat: enforce global emergency and confirmed recovery"
```

### Task 4: Build Versioned Card Layout State

**Files:**
- Create: `src/state/layoutStore.ts`
- Create: `src/state/layoutStore.test.ts`
- Modify: `src/softuiTypes.ts`

**Interfaces:**
- Produces: `CardSize`, `CardPlacement`, `PageLayout`, `loadLayout`, `saveLayout`, `validateLayout`, `resetLayout`

- [ ] **Step 1: Write failing layout-state tests**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { defaultDashboardLayout, loadLayout, saveLayout, validateLayout } from "./layoutStore";

describe("layoutStore", () => {
  beforeEach(() => localStorage.clear());

  it("rejects unknown cards and invalid sizes", () => {
    const result = validateLayout({ schemaVersion: 1, cards: [{ id: "unsafe", size: "9x9", visible: true }] });
    expect(result).toEqual(defaultDashboardLayout);
  });

  it("stores layouts by user and page", () => {
    saveLayout("admin", "dashboard", defaultDashboardLayout);
    expect(loadLayout("admin", "dashboard")).toEqual(defaultDashboardLayout);
    expect(loadLayout("operator", "dashboard")).toEqual(defaultDashboardLayout);
  });
});
```

- [ ] **Step 2: Define exact layout types**

```ts
export type CardSize = "1x1" | "2x1" | "1x2" | "2x2";
export type LayoutPage = "dashboard" | "workspace-monitor";
export type DashboardCardId = "connection" | "sampling" | "recording" | "alerts" | "deviceHealth" | "recentSessions" | "recentEvents";
export type MonitorCardId = "liveChart" | "model3d" | "deviceState" | "commandQueue" | "motorSummary" | "sensorSummary" | "recentAlerts";

export interface CardPlacement {
  id: DashboardCardId | MonitorCardId;
  size: CardSize;
  visible: boolean;
}

export interface PageLayout {
  schemaVersion: 1;
  cards: CardPlacement[];
}
```

- [ ] **Step 3: Implement validation and persistence**

The storage key is `softui:layout:${username}:${page}`. `validateLayout` verifies schema, allowed card IDs, unique IDs and four allowed sizes. Any failure returns the page default without throwing.

- [ ] **Step 4: Run tests and build**

```powershell
npm.cmd run test:unit -- src/state/layoutStore.test.ts
npm.cmd run build
```

Expected: both commands exit `0`.

- [ ] **Step 5: Commit**

```powershell
git add src/state/layoutStore* src/softuiTypes.ts
git commit -m "feat: add versioned user card layouts"
```

### Task 5: Implement Accessible Card Editing

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/cards/CardLayoutEditor.tsx`
- Create: `src/components/cards/SortableCard.tsx`
- Create: `src/components/cards/CardSizeMenu.tsx`
- Create: `src/components/cards/CardLayoutEditor.test.tsx`
- Create: `src/components/cards/cards.css`

**Interfaces:**
- Consumes: `PageLayout`, `CardPlacement`, `CardSize`
- Produces: `onSave(layout: PageLayout)`, `onCancel()`, `onReset()`

- [ ] **Step 1: Install sortable dependencies**

```powershell
npm.cmd install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

- [ ] **Step 2: Write the failing editor test**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CardLayoutEditor } from "./CardLayoutEditor";
import { defaultDashboardLayout } from "../../state/layoutStore";

it("changes a card only to an allowed preset size", async () => {
  const save = vi.fn();
  render(<CardLayoutEditor layout={defaultDashboardLayout} onSave={save} onCancel={vi.fn()} onReset={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "调整连接状态卡片大小" }));
  await userEvent.click(screen.getByRole("menuitem", { name: "宽 2×1" }));
  await userEvent.click(screen.getByRole("button", { name: "保存布局" }));
  expect(save.mock.calls[0][0].cards.find((card: { id: string }) => card.id === "connection").size).toBe("2x1");
});
```

- [ ] **Step 3: Implement pointer and keyboard sorting**

Configure `DndContext` with `PointerSensor`, `KeyboardSensor`, `sortableKeyboardCoordinates`, `closestCenter`, and `rectSortingStrategy`. Use a dedicated icon handle with `aria-label="移动卡片"`; normal mode renders no drag listeners.

- [ ] **Step 4: Map four sizes to CSS tracks**

```ts
export const cardSizeClass: Record<CardSize, string> = {
  "1x1": "card-size-small",
  "2x1": "card-size-wide",
  "1x2": "card-size-tall",
  "2x2": "card-size-large",
};
```

```css
.card-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 132px; gap: 12px; }
.card-size-wide { grid-column: span 2; }
.card-size-tall { grid-row: span 2; }
.card-size-large { grid-column: span 2; grid-row: span 2; }
```

- [ ] **Step 5: Run editor tests and build**

```powershell
npm.cmd run test:unit -- src/components/cards/CardLayoutEditor.test.tsx
npm.cmd run build
```

Expected: both commands exit `0`.

- [ ] **Step 6: Commit**

```powershell
git add package.json package-lock.json src/components/cards
git commit -m "feat: add accessible preset card layout editor"
```

### Task 6: Migrate Dashboard And Device Workspace

**Files:**
- Create: `src/features/dashboard/DashboardPage.tsx`
- Create: `src/features/dashboard/dashboardCards.tsx`
- Create: `src/features/dashboard/DashboardPage.test.tsx`
- Create: `src/features/device-workspace/DeviceWorkspacePage.tsx`
- Create: `src/features/device-workspace/DeviceContextPanel.tsx`
- Create: `src/features/device-workspace/MonitorPane.tsx`
- Create: `src/features/device-workspace/LiveDataPane.tsx`
- Create: `src/features/device-workspace/ManualControlPane.tsx`
- Create: `src/features/device-workspace/AutomaticControlPane.tsx`
- Create: `src/features/device-workspace/PlaybackPane.tsx`
- Create: `src/features/device-workspace/DeviceWorkspacePage.test.tsx`
- Modify: `src/app/AppRouter.tsx`
- Modify: `src/App.tsx:542-1024`

**Interfaces:**
- Consumes: `RuntimeSnapshot`, connected devices, runtime statuses, recorder/playback state, controller callbacks
- Produces: `DashboardPage`, `DeviceWorkspacePage`, `WorkspaceTab = "monitor" | "live-data" | "manual" | "automatic" | "playback"`

- [ ] **Step 1: Write failing workspace navigation tests**

```tsx
const workspaceProps: DeviceWorkspacePageProps = {
  snapshot: fixtureSnapshot,
  currentDeviceId: "softui-sim-01",
  connectedDevices: [],
  deviceStatuses: {},
  recorderStatus: { active: false, sessionId: "", sessionName: "", frameCount: 0, elapsedSecs: 0, paused: false },
  sessions: [],
  playbackStatus: null,
  onSelectDevice: vi.fn(),
  onOpenConnectDialog: vi.fn(),
  onDisconnectDevice: vi.fn(),
  onRefreshSerialPorts: vi.fn(),
  onSystemControl: vi.fn(),
  onSendMotor: vi.fn(),
  onWorkspaceCommand: vi.fn(),
};

it("separates manual and automatic control", async () => {
  render(<DeviceWorkspacePage {...workspaceProps} />);
  await userEvent.click(screen.getByRole("tab", { name: "手动控制" }));
  expect(screen.getByRole("heading", { name: "电机与弯曲控制" })).toBeVisible();
  expect(screen.queryByText("循环寿命控制")).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("tab", { name: "自动控制" }));
  expect(screen.getByText("循环寿命控制")).toBeVisible();
});
```

Define `DeviceWorkspacePageProps` with exactly the fields used by `workspaceProps`; export it from `DeviceWorkspacePage.tsx` so the test is type-checked against the production contract.

- [ ] **Step 2: Implement the five tabs**

`DeviceWorkspacePage` uses `WorkbenchLayout`, `DeviceContextPanel` and `PageTabs`. Only the active pane mounts. `ManualControlPane` owns motor, home, calibration and bend forms; `AutomaticControlPane` owns PID, active and cycle control; `PlaybackPane` wraps the existing `PlaybackBar`.

- [ ] **Step 3: Apply safe-command policy to every dangerous callback**

Map commands exactly:

```ts
motor -> "motorMove"
home -> "home"
calibrateSensor -> "calibrate"
bend -> "bend"
activeTick/start -> "activeControl"
cycle start -> "cycleControl"
```

All request payloads include `currentDeviceId`.

- [ ] **Step 4: Build configurable dashboard and monitor cards**

`dashboardCards.tsx` and monitor card registry map stable card IDs to render functions. Both pages load the user/page layout, render visible cards, expose `编辑布局`, and save only through `layoutStore`.

The `model3d` monitor card wraps the existing `RobotScene` component. Keep the Three.js scene instance mounted while card size or theme changes; resize its renderer from a `ResizeObserver` instead of reconstructing the scene.

- [ ] **Step 5: Replace old inline pages**

Route new pages from `AppRouter`, then remove `DashboardPage` and `WorkspacePage` definitions from `App.tsx`. Keep controller callbacks in `App.tsx` until the final cleanup phase.

- [ ] **Step 6: Run phase checks**

```powershell
npm.cmd run test:unit
npm.cmd run test:ui-regressions
npm.cmd run test:layout-regressions
npm.cmd run build
cargo test --manifest-path src-tauri/Cargo.toml emergency
```

Expected: all commands exit `0`.

- [ ] **Step 7: Commit**

```powershell
git add src/features src/app/AppRouter.tsx src/App.tsx scripts
git commit -m "feat: migrate dashboard and device workbench"
```

## Phase Verification

```powershell
npm.cmd run test:unit
npm.cmd run test:ui-regressions
npm.cmd run test:layout-regressions
npm.cmd run build
cargo test --manifest-path src-tauri/Cargo.toml
git status --short
```

Expected: all tests and build pass; the worktree is clean.

# Stability And Runtime Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成 Phase 4 稳定性和 Phase 5 运行时补强：前端崩溃边界、轮询防重叠、构建分包，以及协议、传输、命令队列边界测试。

**Architecture:** 前端通过 React error boundary 和串行刷新 runner 防止崩溃与请求堆积；Vite 通过 manualChunks 拆分 vendor；Rust 在现有协议、传输、设备运行时上补齐边界测试并收紧命令队列上限。

**Tech Stack:** React 19, TypeScript, Vitest, Vite, Rust, Tauri 2, serialport.

## Global Constraints

- 不替换 uPlot、Three.js、TanStack Table 或现有后端命令。
- 页面组件不直接调用 Tauri `invoke`。
- 每个行为变更先写失败测试。
- 每次任务结束跑对应测试并提交。
- 普通冲突按最合理工程选择处理，不打断用户确认。

---

### Task 1: Add Frontend Error Boundary

**Files:**
- Create: `src/components/feedback/ErrorBoundary.tsx`
- Create: `src/components/feedback/ErrorBoundary.test.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `ErrorBoundary` class component with `reset()` and fallback UI.

- [ ] **Step 1: Write failing boundary test**

```tsx
function Boom() {
  throw new Error("render failure");
}

it("shows a recoverable crash fallback", () => {
  render(
    <ErrorBoundary>
      <Boom />
    </ErrorBoundary>,
  );
  expect(screen.getByRole("heading", { name: "界面发生错误" })).toBeVisible();
  expect(screen.getByRole("button", { name: "重新加载" })).toBeVisible();
});
```

- [ ] **Step 2: Run test to verify failure**

```powershell
.\node_modules\.bin\vitest.cmd run src/components/feedback/ErrorBoundary.test.tsx
```

Expected: FAIL because component is missing.

- [ ] **Step 3: Implement boundary**

```tsx
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  reset = () => {
    this.setState({ hasError: false });
    window.location.hash = "#/dashboard";
  };
  render() {
    if (this.state.hasError) return fallback;
    return this.props.children;
  }
}
```

- [ ] **Step 4: Wrap App in `main.tsx`**

```tsx
<React.StrictMode>
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
</React.StrictMode>
```

- [ ] **Step 5: Run test and build**

Expected: both exit `0`.

- [ ] **Step 6: Commit**

```powershell
git add src/components/feedback src/main.tsx
git commit -m "feat: add recoverable frontend error boundary"
```

### Task 2: Split Vendor Chunks

**Files:**
- Modify: `vite.config.ts`

- [ ] **Step 1: Add manualChunks**

```ts
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes("node_modules/three")) return "three";
        if (id.includes("node_modules/uplot")) return "uplot";
        if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "react";
        if (id.includes("node_modules")) return "vendor";
      },
    },
  },
},
```

- [ ] **Step 2: Run build**

Expected: no single chunk over 1000 kB; exit `0`.

- [ ] **Step 3: Commit**

```powershell
git add vite.config.ts
git commit -m "build: split vendor chunks for desktop startup"
```

### Task 3: Serialize Background Refreshes

**Files:**
- Create: `src/lib/serialRunner.ts`
- Create: `src/lib/serialRunner.test.ts`
- Modify: `src/App.tsx`
- Modify: `src/features/charts/ChartsPage.tsx`

**Interfaces:**
- Produces: `createSerialRunner(): (task: () => Promise<T>) => Promise<T | undefined>`

- [ ] **Step 1: Write failing runner test**

```ts
it("skips a second refresh while the first is running", async () => {
  const run = createSerialRunner();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const first = run(async () => { await gate; return "first"; });
  const second = run(async () => "second");
  release();
  expect(await first).toBe("first");
  expect(await second).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify failure**

Expected: FAIL because `createSerialRunner` is missing.

- [ ] **Step 3: Implement `serialRunner`**

```ts
export function createSerialRunner() {
  let running = false;
  return async <T>(task: () => Promise<T>): Promise<T | undefined> => {
    if (running) return undefined;
    running = true;
    try {
      return await task();
    } finally {
      running = false;
    }
  };
}
```

- [ ] **Step 4: Use in AppController tick**

```ts
const tickRunnerRef = useRef(createSerialRunner());
useEffect(() => {
  const timer = window.setInterval(() => {
    void tickRunnerRef.current(() => fetchSnapshot("tick_snapshot"));
  }, 1000);
  return () => window.clearInterval(timer);
}, [fetchSnapshot]);
```

- [ ] **Step 5: Use in charts live window**

```ts
const refreshRunnerRef = useRef(createSerialRunner());
const refresh = async () => {
  await refreshRunnerRef.current(async () => {
    const frames = await loadLiveWindow(240, liveDeviceId);
    if (!cancelled) { setHistoryFrames(frames); setChartError(""); }
  });
};
```

- [ ] **Step 6: Run tests and build**

Expected: exit `0`.

- [ ] **Step 7: Commit**

```powershell
git add src/lib src/App.tsx src/features/charts/ChartsPage.tsx
git commit -m "perf: serialize background snapshot refreshes"
```

### Task 4: Protocol Edge Tests

**Files:**
- Modify: `src-tauri/src/protocol.rs`

- [ ] **Step 1: Add failing edge tests**

```rust
#[test]
fn rejects_invalid_status_header() {
  assert_eq!(parse_status_frame(&[0xAA, 0x02, 0x00, 0x00]), Err(ProtocolError::InvalidHeader));
}

#[test]
fn rejects_truncated_status_frame() {
  assert_eq!(parse_status_frame(&[0xBB, 0x02, 0x14, 0x01]), Err(ProtocolError::InvalidLength));
}

#[test]
fn rejects_out_of_range_command_values() {
  assert_eq!(encode_motor_command(1, f64::NAN, 10.0, 10.0), Err(ProtocolError::ValueOutOfRange("position")));
  assert_eq!(encode_bend_command(4, 1.0, 0, 1.0), Err(ProtocolError::ValueOutOfRange("direction")));
}

#[test]
fn rejects_oversized_payload() {
  assert_eq!(encode_frame(FrameHead::Motor, 0x03, &vec![0u8; 256]), Err(ProtocolError::InvalidLength));
}
```

- [ ] **Step 2: Run `cargo test -p softui-desktop protocol`**

Expected: new tests FAIL before implementation where behavior is missing.

- [ ] **Step 3: Add missing validation**

`parse_status_frame` must check `frame[0]` before length; `scaled_u16` and `raw_i32` already reject non-finite values. Add header check if missing and verify oversized payload returns `InvalidLength`.

- [ ] **Step 4: Run all Rust tests**

Expected: `cargo test --manifest-path src-tauri/Cargo.toml` exits `0`.

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/protocol.rs
git commit -m "test: cover protocol edge and range errors"
```

### Task 5: Transport Config Validation Tests

**Files:**
- Modify: `src-tauri/src/transport.rs`

- [ ] **Step 1: Add failing validation tests**

```rust
#[test]
fn rejects_unsupported_data_bits() {
  let config = SerialConnectionConfig { data_bits: 6, ..SerialConnectionConfig::legacy_default("COM1") };
  assert!(matches!(SerialTransport::open(config), Err(TransportError::Serial(_))));
}

#[test]
fn rejects_unsupported_parity() {
  let config = SerialConnectionConfig { parity: "mark".to_string(), ..SerialConnectionConfig::legacy_default("COM1") };
  assert!(matches!(SerialTransport::open(config), Err(TransportError::Serial(_))));
}
```

- [ ] **Step 2: Run transport tests**

Expected: FAIL because `SerialConnectionConfig` needs a constructor or the test does not compile.

- [ ] **Step 3: Add `SerialConnectionConfig::builder` or public fields test constructor**

Keep fields public and initialize a full config in tests.

- [ ] **Step 4: Run `cargo test --manifest-path src-tauri/Cargo.toml transport`**

Expected: exit `0`.

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/transport.rs
git commit -m "test: validate serial config before opening"
```

### Task 6: Bound The Command Queue

**Files:**
- Modify: `src-tauri/src/device.rs`

- [ ] **Step 1: Add failing queue limit test**

```rust
#[test]
fn queue_has_bounded_capacity() {
  let mut runtime = DeviceRuntime::new(SimulatorTransport::new().unwrap());
  for _ in 0..MAX_PENDING_COMMANDS + 5 {
    runtime.enqueue_command(vec![0xAA], CommandPriority::Normal);
  }
  assert_eq!(runtime.status().pending_commands, MAX_PENDING_COMMANDS);
}
```

- [ ] **Step 2: Run device tests**

Expected: FAIL because `MAX_PENDING_COMMANDS` is missing.

- [ ] **Step 3: Add constant and enforce bound**

```rust
pub const MAX_PENDING_COMMANDS: usize = 64;
```

In `enqueue_command`, drop from front when full and increment a dropped counter.

- [ ] **Step 4: Run device tests**

Expected: exit `0`.

- [ ] **Step 5: Commit**

```powershell
git add src-tauri/src/device.rs
git commit -m "fix: bound pending command queue"
```

### Task 7: Final Verification And Release Build

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

Expected: `softui-desktop.exe` and installers produced.

- [ ] **Step 3: Update progress doc and commit**

```powershell
git add docs/development-status.md
git commit -m "docs: record stability and runtime completion"
```

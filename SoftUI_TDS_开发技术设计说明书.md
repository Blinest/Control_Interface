# SoftUI 开发技术设计说明书（TDS）

**项目名称：** SoftUI  
**项目代号：** SoftUI Next  
**目标框架：** Tauri 2 + Rust + React + TypeScript + Three.js  
**文档版本：** v2.0-draft  
**文档日期：** 2026-07-14  
**需求依据：** 《SoftUI 需求规格说明书（SRS）》  
**兼容基线：** `Blinest/Control_Interface` 现有 PyQt5 代码与 Legacy Protocol V1  
**适用对象：** Rust/前端开发者、架构师、测试人员、硬件联调人员、AI 编码代理

---

## 1. 设计目标

本设计说明给出 SoftUI 从 PyQt5 重构到 Tauri 2 技术体系的可落地方案。

设计目标：

1. 保留现有硬件协议和控制能力；
2. 将串口、协议、控制、存储和日志放在 Rust 后端；
3. 将界面、图表、工作区和 3D 放在 React 前端；
4. 使用严格的类型化 IPC 连接前后端；
5. 高频数据不通过 React 逐帧重渲染；
6. 所有设备接口可被模拟；
7. 所有控制算法可脱离 UI 测试；
8. 默认离线、安全、可诊断；
9. 支持 Windows 正式发布和 Linux 构建；
10. 采用渐进迁移，避免一次性推翻旧版。

---

## 2. 技术路线结论

### 2.1 桌面容器

- Tauri 2.x；
- Rust stable；
- Windows 使用 WebView2；
- Linux 使用系统 WebKitGTK；
- 使用 Tauri capability/permission 机制限制前端能力。

### 2.2 前端

- React 19.x；
- TypeScript 5.x；
- Vite；
- Zustand：客户端状态；
- React Router：页面导航；
- TanStack Table：实时表格；
- uPlot：高频时序曲线；
- Three.js：三维连续体模型；
- React Hook Form + Zod：配置表单和前端校验；
- CSS Variables/Design Tokens：主题；
- Vitest + Testing Library：前端测试；
- Playwright：E2E。

### 2.3 Rust 后端

- Tauri 2；
- Tokio：异步任务和协调；
- `serialport`：串口访问；
- `serde` / `serde_json`：序列化；
- `thiserror` / `anyhow`：错误；
- `tracing` / `tracing-subscriber` / `tracing-appender`：日志；
- `rusqlite`：本地数据库；
- `argon2`：密码哈希；
- `keyring`：操作系统安全凭据；
- `uuid`：ID；
- `chrono` 或 `time`：时间；
- `tokio-util`：取消令牌；
- `flume` 或 Tokio bounded channel：有界数据管道；
- `csv`：导出；
- `zip`：诊断包和会话包；
- `schemars`：配置 schema；
- `ts-rs`：Rust 数据结构生成 TypeScript 类型；
- `proptest`：协议属性测试。

依赖版本使用稳定版本并通过 `Cargo.lock`、`pnpm-lock.yaml` 锁定；不得在代码中依赖未固定的 CDN 资源。

### 2.4 前后端职责

| 能力 | Rust 后端 | React 前端 |
|---|---:|---:|
| 串口扫描/读写 | ✓ | |
| 帧解析/校验 | ✓ | |
| PID/闭环状态机 | ✓ | |
| 用户权限最终校验 | ✓ | |
| SQLite/文件写入 | ✓ | |
| 日志与诊断 | ✓ | |
| 页面和表单 | | ✓ |
| 实时表格 | | ✓ |
| 曲线 | | ✓ |
| Three.js | | ✓ |
| 主题和布局 | | ✓ |

原则：**任何可能影响设备安全、协议正确性或数据完整性的逻辑不得只存在于前端。**

---

## 3. 总体架构

```text
┌─────────────────────────────────────────────────────────┐
│                     Tauri Desktop App                   │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │ React + TypeScript Frontend                       │  │
│  │ Pages / Workspaces / Forms / Table / uPlot       │  │
│  │ Three.js / Theme / Playback UI / Log Viewer      │  │
│  └───────────────────▲───────────────────────────────┘  │
│                      │ invoke / event / channel          │
│  ┌───────────────────▼───────────────────────────────┐  │
│  │ Tauri Application Layer                          │  │
│  │ Commands / Event Gateway / Permission Guard      │  │
│  └───────────────────▲───────────────────────────────┘  │
│                      │                                   │
│  ┌───────────────────▼───────────────────────────────┐  │
│  │ Rust Domain & Services                           │  │
│  │ Connection / Protocol / Device / Control         │  │
│  │ Session / Auth / Logging / Diagnostics           │  │
│  └───────────────────▲───────────────────────────────┘  │
│                      │                                   │
│  ┌───────────────────▼───────────────────────────────┐  │
│  │ Infrastructure                                   │  │
│  │ Serial / Simulator / SQLite / File System        │  │
│  │ Credential Store / Bundle Resources              │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 4. 架构原则

1. **领域优先：** 协议、设备状态和控制算法不依赖 Tauri 或 React；
2. **有界队列：** 高频数据流不得使用无限队列；
3. **快照与批量：** UI 接收最新快照和批量曲线点，而不是逐字节事件；
4. **单写入者：** 每个串口由一个 worker 持有，避免并发写冲突；
5. **命令优先级：** 紧急停止高于普通控制；
6. **取消可传播：** 关闭设备时所有子任务收到取消信号；
7. **事件可追踪：** 所有操作具有关联 ID；
8. **配置可迁移：** 所有持久化结构带版本；
9. **模拟器同接口：** 模拟器和真实串口实现同一个 Transport trait；
10. **前端最小权限：** 不开放任意 shell、任意文件或远程网页权限；
11. **资源可释放：** 图表、Three.js、事件监听器和设备任务必须显式清理；
12. **兼容适配：** 旧协议由独立 adapter 实现，不污染未来协议。

---

## 5. 推荐仓库结构

```text
SoftUI/
├─ apps/
│  └─ desktop/
│     ├─ package.json
│     ├─ vite.config.ts
│     ├─ tsconfig.json
│     ├─ src/
│     │  ├─ app/
│     │  │  ├─ App.tsx
│     │  │  ├─ router.tsx
│     │  │  └─ providers/
│     │  ├─ pages/
│     │  │  ├─ login/
│     │  │  ├─ dashboard/
│     │  │  ├─ devices/
│     │  │  ├─ charts/
│     │  │  ├─ model3d/
│     │  │  ├─ sessions/
│     │  │  ├─ logs/
│     │  │  └─ settings/
│     │  ├─ features/
│     │  │  ├─ auth/
│     │  │  ├─ connection/
│     │  │  ├─ device-control/
│     │  │  ├─ telemetry/
│     │  │  ├─ closed-loop/
│     │  │  ├─ session/
│     │  │  └─ diagnostics/
│     │  ├─ components/
│     │  ├─ stores/
│     │  ├─ services/
│     │  │  ├─ tauriClient.ts
│     │  │  ├─ eventClient.ts
│     │  │  └─ streamBuffers.ts
│     │  ├─ three/
│     │  ├─ charts/
│     │  ├─ styles/
│     │  ├─ generated/
│     │  │  └─ contracts.ts
│     │  └─ i18n/
│     └─ src-tauri/
│        ├─ Cargo.toml
│        ├─ tauri.conf.json
│        ├─ capabilities/
│        ├─ icons/
│        ├─ resources/
│        │  ├─ models/
│        │  ├─ schemas/
│        │  └─ fixtures/
│        └─ src/
│           ├─ main.rs
│           ├─ lib.rs
│           ├─ app_state.rs
│           ├─ commands/
│           ├─ events/
│           └─ bootstrap/
│
├─ crates/
│  ├─ softui-domain/
│  ├─ softui-protocol/
│  ├─ softui-transport/
│  ├─ softui-device/
│  ├─ softui-control/
│  ├─ softui-session/
│  ├─ softui-auth/
│  ├─ softui-storage/
│  ├─ softui-simulator/
│  └─ softui-diagnostics/
│
├─ docs/
│  ├─ srs.md
│  ├─ tds.md
│  ├─ protocol-v1.md
│  ├─ test-plan.md
│  ├─ migration-plan.md
│  └─ adr/
│
├─ fixtures/
│  ├─ protocol/
│  ├─ sessions/
│  └─ simulator/
├─ scripts/
├─ tests/
│  ├─ integration/
│  └─ e2e/
├─ Cargo.toml
├─ pnpm-workspace.yaml
└─ README.md
```

---

## 6. Rust crate 设计

### 6.1 `softui-domain`

纯领域模型，不依赖 Tauri、数据库或串口。

主要类型：

- `DeviceId`
- `ConnectionId`
- `SessionId`
- `UserId`
- `DeviceSnapshot`
- `MotorState`
- `SensorState`
- `BendState`
- `CommandEnvelope`
- `ControlProfile`
- `FilterProfile`
- `FrameQuality`
- `SoftUiError`

要求：

- 所有单位写入字段名或使用 newtype；
- 不使用含糊的 `value1/value2/value3` 进入公共 API；
- 协议未确认字段在领域层使用 channel，并在显示层配置别名；
- 可序列化；
- 可生成 TypeScript 类型；
- 关键字段不可使用裸字符串 ID。

### 6.2 `softui-protocol`

职责：

1. Legacy Protocol V1 帧编码；
2. 增量字节流解析；
3. 帧头、长度、校验和验证；
4. 状态帧解码；
5. 命令帧编码；
6. 协议统计；
7. 测试向量。

核心接口：

```rust
pub trait ProtocolCodec: Send + Sync {
    fn version(&self) -> &'static str;
    fn push_bytes(&mut self, input: &[u8]) -> Vec<Result<DecodedFrame, ProtocolError>>;
    fn encode_command(&self, command: &DeviceCommand) -> Result<Vec<u8>, ProtocolError>;
}
```

### 6.3 `softui-transport`

职责：串口扫描、连接打开/关闭、字节读写、端口健康检测、模拟传输抽象和写队列优先级。

```rust
#[async_trait]
pub trait Transport: Send {
    async fn open(&mut self) -> Result<(), TransportError>;
    async fn read(&mut self, buffer: &mut [u8]) -> Result<usize, TransportError>;
    async fn write_all(&mut self, data: &[u8]) -> Result<(), TransportError>;
    async fn close(&mut self) -> Result<(), TransportError>;
    fn descriptor(&self) -> TransportDescriptor;
}
```

若 `serialport` 的读取为阻塞 API，则每个连接使用独立 blocking worker，并通过有界 channel 与异步协调层通信。

### 6.4 `softui-device`

职责：设备生命周期、握手、状态快照、命令队列、连接健康、多设备 registry、任务取消和资源释放。

```rust
pub struct DeviceRuntime {
    id: DeviceId,
    state: DeviceLifecycleState,
    transport_task: JoinHandle<()>,
    parser_task: JoinHandle<()>,
    control_task: JoinHandle<()>,
    cancellation: CancellationToken,
}
```

### 6.5 `softui-control`

职责：PID、闭环状态机、循环寿命检测、主动控制、命令重试、安全联锁和参数校验。不依赖 React、Tauri 和 SQLite。

### 6.6 `softui-session`

职责：会话创建、暂停、恢复、停止、数据批量写入、会话回放、CSV 导出、会话包导入/导出和异常会话恢复。

### 6.7 `softui-auth`

职责：用户、Argon2id 密码哈希、登录限流、会话 token、角色和权限、旧 SHA-256 用户迁移、操作系统凭据。

### 6.8 `softui-storage`

职责：应用数据库、配置仓库、schema 迁移、原子写、数据目录和旧版导入。

### 6.9 `softui-simulator`

职责：状态帧生成、命令响应、设备动力学简化模型、故障注入、确定性随机种子和测试脚本。

### 6.10 `softui-diagnostics`

职责：版本和环境摘要、日志收集、配置脱敏、最近会话摘要、诊断 ZIP 和崩溃信息。

---

## 7. 前端架构

### 7.1 状态分类

由 Rust 为唯一真源：

- 连接状态；
- 设备快照；
- 控制状态；
- 当前用户和权限；
- 会话状态；
- 日志；
- 配置持久化结果。

由 Zustand 管理的前端交互状态：

- 当前页面；
- 当前设备；
- 面板开关；
- 图表选择；
- UI 暂停；
- 3D 相机状态；
- 临时表单；
- 未保存布局。

不得将完整无限历史放入 Zustand。

### 7.2 数据接收策略

使用三类数据：

1. **低频状态事件：** 连接、错误、会话状态；
2. **最新快照：** 每设备 10–30 Hz；
3. **批量图表点：** 例如每 50 ms 或 100 ms 一批。

React 不应对每个串口帧执行全局 setState。

```text
Rust high-rate stream
  → per-device ring buffer
  → frontend batch event
  → mutable typed-array buffer
  → chart render tick
```

### 7.3 组件边界

- 页面组件只编排；
- Feature 组件负责业务交互；
- 通用组件不直接 invoke Rust；
- IPC 统一封装在 `services/tauriClient.ts`；
- Event listener 统一注册和清理；
- Three.js 和 uPlot 封装为命令式 adapter，避免频繁 React 重建。

---

## 8. 应用状态与生命周期

### 8.1 全局 AppState

```rust
pub struct AppState {
    pub auth: Arc<AuthService>,
    pub devices: Arc<DeviceRegistry>,
    pub sessions: Arc<SessionService>,
    pub settings: Arc<SettingsService>,
    pub logs: Arc<LogQueryService>,
    pub diagnostics: Arc<DiagnosticsService>,
}
```

Tauri command 只调用服务，不直接访问底层文件或串口。

### 8.2 设备状态机

```text
Idle
  ├─ connect → Connecting
Connecting
  ├─ opened → Handshaking
  ├─ fail → Error
Handshaking
  ├─ valid_response → Ready
  ├─ timeout → Degraded
Ready
  ├─ enable → Enabled
  ├─ link_lost → Reconnecting
  ├─ disconnect → Closing
Enabled
  ├─ disable → Ready
  ├─ emergency_stop → EmergencyStopped
  ├─ link_lost → Reconnecting
EmergencyStopped
  ├─ acknowledge/reset → Ready
  ├─ disconnect → Closing
Reconnecting
  ├─ success → Handshaking
  ├─ exhausted → Error
Closing
  └─ closed → Idle
Error
  ├─ retry → Connecting
  └─ reset → Idle
```

### 8.3 控制状态机

闭环控制不得由多个布尔变量松散表示。

```rust
enum ClosedLoopState {
    Disabled,
    Armed,
    Contracting,
    WaitingForHighThreshold,
    Extending,
    WaitingForLowThreshold,
    Paused,
    Completed,
    Fault(ControlFault),
}
```

每次转换记录前状态、后状态、原因、输入快照、输出命令、时间戳和循环次数。

---

## 9. 串口连接设计

### 9.1 连接配置

```rust
pub struct SerialProfile {
    pub id: Uuid,
    pub name: String,
    pub port_selector: PortSelector,
    pub baud_rate: u32,
    pub data_bits: DataBits,
    pub parity: Parity,
    pub stop_bits: StopBits,
    pub flow_control: FlowControl,
    pub read_timeout_ms: u64,
    pub reconnect: ReconnectPolicy,
}
```

默认旧版参数：

- baud: 9600；
- data bits: 8；
- parity: none；
- stop bits: 1；
- flow control: none；
- read timeout: 50 ms。

### 9.2 Worker 模型

每个物理端口只由一个线程/任务持有：

```text
Serial Worker
  ├─ blocking read loop
  ├─ priority write receiver
  ├─ health check
  └─ cancellation
```

读数据进入有界 `raw_bytes_tx`。如果下游阻塞：

- 原始控制数据不得静默无限堆积；
- 记录 backpressure 指标；
- 必要时丢弃仅用于 UI 的旧批次；
- 会话记录通道单独管理。

### 9.3 写队列优先级

```rust
enum CommandPriority {
    Emergency = 0,
    Safety = 1,
    Control = 2,
    Calibration = 3,
    Diagnostic = 4,
}
```

规则：

1. Emergency 可抢占普通待发送队列；
2. 同设备写操作串行；
3. 每个命令有 `command_id`；
4. 发送成功不等同设备执行成功；
5. 需要确认的命令进入 pending registry；
6. 超时后由控制层决定重试，不由串口层自动重试。

### 9.4 端口发现

```rust
pub struct SerialPortInfo {
    pub port_name: String,
    pub port_type: String,
    pub manufacturer: Option<String>,
    pub product: Option<String>,
    pub serial_number: Option<String>,
    pub vid: Option<u16>,
    pub pid: Option<u16>,
    pub suggested: bool,
    pub filtered_reason: Option<String>,
}
```

过滤规则可配置，不在代码中硬编码唯一 COM3。

---

## 10. Legacy Protocol V1 设计

### 10.1 通用帧

```text
+--------+------+--------+----------+----------+
| Header | Func | Length | Data ... | Checksum |
+--------+------+--------+----------+----------+
```

```text
checksum = sum(all previous bytes) & 0xFF
```

- 电机/控制类下行通常使用 `0xAA`；
- 传感器/状态类使用 `0xBB`；
- 最终以现有代码和硬件协议确认表为准。

### 10.2 命令映射

| Func | 用途 | 兼容要求 |
|---:|---|---|
| `0x00` | 失能/关闭控制系统 | 必须 |
| `0x01` | 使能/启动控制系统 | 必须 |
| `0x02` | 紧急停止 | 必须，最高优先级 |
| `0x03` | 电机控制/传感器校准 | 必须 |
| `0x04` | 一键归中 | 必须 |
| `0x05` | 两段联动弯曲 | 必须 |
| `0x06` | 主动控制保持 | 应支持 |
| `0xFE` | 握手唤醒 | 必须 |

### 10.3 电机命令

逻辑字段：

```text
motor_id
direction
distance_or_position × 100
velocity × 100
acceleration × 100
```

要求：

- 大端；
- 有符号数的字段使用明确整数类型；
- 范围校验先于编码；
- 编码函数必须有 golden tests；
- 不允许在 UI 中手写字节拼接。

### 10.4 传感器校准

```text
sensor_id
calibration_value × 100
```

要求同上。

### 10.5 状态帧

当前逻辑结构：

```text
BB 02
length
motor_count
sensor_count
motor blocks: motor_count × 7 bytes
sensor blocks: sensor_count × 12 bytes
section1 angle
section2 angle
system status
checksum
```

以上偏移必须由真实帧和旧 `ProtocolParser` 再确认，正式实现应把协议布局写成独立文档和测试 fixture。

### 10.6 增量解析器

```text
append bytes
  → find candidate header
  → require minimum header length
  → read length
  → reject impossible length
  → wait for full frame
  → verify checksum
  → decode
  → consume full frame
```

错误恢复：

- 非法头：丢弃到下一个候选头；
- 非法长度：丢弃当前头一个字节；
- 校验失败：记录原始片段，丢弃当前头一个字节后继续；
- 不得一次清空整个缓冲，避免丢失后续合法帧。

### 10.7 协议统计

每连接维护：

- bytes_received；
- bytes_sent；
- frames_valid；
- checksum_errors；
- length_errors；
- decode_errors；
- dropped_bytes；
- last_valid_frame_at；
- last_error_at。

---

## 11. 数据处理管线

```text
Transport Bytes
  → Frame Assembler
  → Protocol Validation
  → Decode Raw State
  → Unit Conversion
  → Filter
  → Device Snapshot
  → Control Engine
  → Ring Buffers
  → Session Recorder
  → UI Snapshot Batch
  → Charts / Table / Three.js
```

### 11.1 分层要求

1. Raw bytes 可选记录；
2. Parse 输出不做 UI 格式化；
3. Unit conversion 集中管理；
4. Filter 可配置；
5. Control 只消费明确版本的快照；
6. Recorder 与 UI 分流；
7. 回放从 `Device Snapshot` 或 raw frame 层重新进入管线。

### 11.2 缓冲策略

每设备至少维护：

- 最新快照：watch channel；
- UI 曲线环形缓存；
- 会话写入批次；
- 最近原始帧诊断缓存；
- pending command map。

建议：

- UI 曲线：最近 60–300 秒；
- 原始诊断：最近 1,000 帧；
- 前端表格：最近 500–2,000 行；
- 会话数据：持续写盘。

### 11.3 滤波

```rust
pub trait Filter<T> {
    fn reset(&mut self);
    fn update(&mut self, sample: T) -> T;
}
```

首版实现：Median3、DeltaClamp、ExponentialMovingAverage、FilterChain 和 Bypass。每通道保留原始值与过滤值。

---

## 12. 控制系统设计

### 12.1 安全联锁

所有运动命令执行前：

1. 用户已登录；
2. 权限允许；
3. 设备连接为 Ready/Enabled；
4. 无 EmergencyStopped；
5. 参数合法；
6. 协议 codec 可用；
7. 设备未处于回放模式；
8. 当前操作未与其他独占控制冲突。

### 12.2 PID

```rust
pub struct PidConfig {
    pub kp: f64,
    pub ki: f64,
    pub kd: f64,
    pub dt_seconds: f64,
    pub output_min: f64,
    pub output_max: f64,
    pub integral_min: f64,
    pub integral_max: f64,
    pub deadband: f64,
}
```

实现要求：

- 防积分饱和；
- 明确采样周期；
- 参数热更新时可选择保留或重置状态；
- NaN/Inf 输入进入 Fault；
- 输出限幅；
- 单元测试覆盖阶跃、稳态、限幅和重置。

### 12.3 循环寿命控制

```rust
pub struct CycleControlProfile {
    pub sensor_id: u8,
    pub sensor_channel: u8,
    pub high_threshold: f64,
    pub low_threshold: f64,
    pub contract_target_mm: f64,
    pub extend_target_mm: f64,
    pub velocity_mm_s: f64,
    pub acceleration_mm_s2: f64,
    pub command_timeout_ms: u64,
    pub max_retries: u32,
    pub max_cycles: Option<u64>,
}
```

状态转换必须基于最新有效快照、阈值去抖、到位容差、超时、重试计数和安全状态。

### 12.4 主动控制

使用可取消 interval task，不使用前端 `setInterval` 作为唯一控制源。

---

## 13. Tauri IPC 设计

### 13.1 规则

1. Command 用于请求/响应；
2. Event 用于低频状态变化；
3. 高频数据使用批量事件或 Tauri channel；
4. 所有 payload 有版本；
5. 所有 command 返回统一 envelope；
6. 错误不返回任意字符串，而是结构化错误；
7. 前端不得直接调用散落的 `invoke()`。

### 13.2 统一响应

```ts
type ApiResult<T> =
  | { ok: true; data: T; requestId: string }
  | { ok: false; error: ApiError; requestId: string };

interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  recoverable: boolean;
}
```

### 13.3 主要 Commands

#### Auth

- `auth_get_status`
- `auth_login`
- `auth_logout`
- `auth_register`
- `auth_change_password`
- `auth_list_users`
- `auth_disable_user`
- `auth_reset_user_password`

#### Connections

- `serial_list_ports`
- `connection_list_profiles`
- `connection_save_profile`
- `device_connect`
- `device_disconnect`
- `device_reconnect`
- `device_list`
- `device_get_snapshot`
- `device_get_protocol_stats`

#### Control

- `device_enable`
- `device_disable`
- `device_emergency_stop`
- `device_reset_emergency`
- `motor_send_command`
- `motor_home`
- `sensor_calibrate`
- `bend_send_combined`
- `active_control_start`
- `active_control_stop`
- `closed_loop_start`
- `closed_loop_pause`
- `closed_loop_resume`
- `closed_loop_stop`
- `closed_loop_update_profile`

#### Sessions

- `session_start`
- `session_pause`
- `session_resume`
- `session_stop`
- `session_list`
- `session_get`
- `session_delete`
- `session_export_csv`
- `session_export_package`
- `session_import_package`
- `playback_open`
- `playback_seek`
- `playback_set_speed`
- `playback_play`
- `playback_pause`
- `playback_close`

#### Logs/Diagnostics

- `logs_query`
- `logs_export`
- `audit_query`
- `diagnostics_get_summary`
- `diagnostics_export_bundle`

#### Settings/Migration

- `settings_get`
- `settings_update`
- `profile_import`
- `profile_export`
- `legacy_detect`
- `legacy_migrate`
- `legacy_get_report`

### 13.4 主要 Events

- `auth/status-changed`
- `serial/ports-changed`
- `device/added`
- `device/removed`
- `device/connection-state`
- `device/snapshot-batch`
- `device/protocol-stats`
- `device/fault`
- `control/state-changed`
- `control/cycle-count`
- `session/state-changed`
- `session/write-warning`
- `playback/position`
- `logs/new-entry`
- `diagnostics/error`

事件 payload 必须包含 `schemaVersion`、`deviceId` 或 `sessionId` 等关联信息。

---

## 14. 存储设计

### 14.1 应用数据目录

使用操作系统应用数据目录，不再默认散落写入用户主目录。

```text
SoftUI/
├─ app.db
├─ config/
│  ├─ app-settings.json
│  ├─ connection-profiles.json
│  ├─ control-profiles.json
│  ├─ filter-profiles.json
│  ├─ model-profiles.json
│  └─ workspace-layout.json
├─ sessions/
├─ logs/
├─ models/
├─ diagnostics/
├─ imports/
└─ backups/
```

旧 `~/.lqts` 和 `~/experiment_data` 仅作为迁移源。

### 14.2 SQLite

`app.db` 保存：

- users；
- audit_events；
- session_index；
- connection_profiles 元数据；
- migration_history；
- app_metadata。

会话数据建议每会话独立目录：

```text
sessions/
└─ 2026-07-14T10-30-00Z_<session-id>/
   ├─ metadata.json
   ├─ samples.sqlite
   ├─ raw_frames.bin
   ├─ control_events.jsonl
   ├─ session.log
   ├─ thumbnail.png
   └─ exports/
```

`samples.sqlite` 使用批量事务写入，避免每帧单独提交。

### 14.3 原子写和迁移

配置写入：

1. 序列化到临时文件；
2. fsync；
3. rename 替换；
4. 保留上一版本备份。

数据库迁移：

- 每次 schema 有版本；
- 启动时事务迁移；
- 失败时回滚；
- 发布前测试从所有受支持旧版本升级。

### 14.4 CSV 导出

导出服务流式读取数据库，避免一次加载全部记录。

支持 UTF-8、UTF-8 BOM、时间范围、设备筛选、原始/滤波/目标字段、小数精度和元数据旁车 JSON。

---

## 15. 认证与权限设计

### 15.1 密码

- 新密码使用 Argon2id；
- 每用户独立随机 salt；
- 参数写入哈希字符串；
- 禁止 SHA-256 直接哈希新密码；
- 旧用户登录成功后立即升级；
- 初始管理员必须修改默认密码。

### 15.2 记住登录

优先使用操作系统 Credential Manager/Keychain/Secret Service。存储用户名和短期本地凭据，不存明文密码。

### 15.3 权限

```rust
enum Permission {
    DeviceView,
    DeviceControl,
    EmergencyStop,
    Calibration,
    ClosedLoopControl,
    SessionManage,
    LogView,
    AuditView,
    DebugTerminal,
    UserManage,
    SettingsManage,
}
```

后端 command 使用 guard：

```rust
require_permission(&session, Permission::DeviceControl)?;
```

### 15.4 Tauri Capability

建议拆分：

- `main-user.json`：普通窗口最小权限；
- `admin-tools.json`：管理员调试窗口；
- `model-view.json`：只允许本地资源；
- 不启用 shell；
- 文件选择通过 dialog plugin；
- 文件读写尽量由 Rust command 完成；
- CSP 禁止远程脚本和不受控资源。

---

## 16. 日志与诊断

### 16.1 结构化日志字段

- timestamp；
- level；
- target/module；
- message；
- request_id；
- user_id；
- device_id；
- connection_id；
- session_id；
- command_id；
- error_code；
- extra。

### 16.2 日志文件

- 按天滚动；
- 同时支持大小上限；
- retention 配置；
- 原始帧单独文件；
- 审计写 SQLite；
- UI 只查询分页结果，不读取整个日志文件。

### 16.3 Panic 与崩溃

- Rust panic hook 记录信息；
- 前端注册 `error` 和 `unhandledrejection`；
- 下次启动显示异常退出提示；
- 不在崩溃报告中写入密码或完整敏感路径。

### 16.4 诊断包

```text
diagnostics/
└─ softui_diag_<timestamp>.zip
   ├─ app-info.json
   ├─ system-info.json
   ├─ device-summary.json
   ├─ configs-redacted/
   ├─ logs/
   ├─ recent-session-summary.json
   ├─ migration-report.json
   └─ crash/
```

---

## 17. 曲线设计

### 17.1 选择 uPlot

原因：适合高频时序数据、包体较轻、可使用 typed arrays、易于与环形缓存配合。

### 17.2 数据路径

```text
snapshot batches
  → ChartBuffer
  → frame scheduler
  → uPlot setData()
```

要求：

- 只更新可见图表；
- 每个图表独立时间窗；
- 历史数据降采样；
- 光标查询原始索引；
- 渲染数据和导出数据分离。

### 17.3 降采样

首版可采用固定像素宽度 min/max bucket；LTTB 作为增强。不得覆盖或修改会话原始数据。

---

## 18. Three.js 三维设计

### 18.1 资源格式

- 正式模型：glTF/GLB；
- 所有资源本地打包或由用户导入本地文件；
- 禁止运行时依赖 CDN；
- 纹理、模型和配置需有版本。

### 18.2 场景组成

```text
RobotScene
├─ Renderer
├─ PerspectiveCamera
├─ OrbitControls
├─ LightRig
├─ Environment
├─ RobotModel
├─ TargetPoseOverlay
├─ FeedbackPose
├─ Axes/Grid
└─ DebugHUD
```

### 18.3 模型配置

```json
{
  "schemaVersion": 1,
  "name": "default_continuum_robot",
  "model": "models/default_robot.glb",
  "section1": {
    "node": "section_1_root",
    "axisMapping": {
      "up": [1, 0, 0],
      "right": [0, 0, -1],
      "down": [-1, 0, 0],
      "left": [0, 0, 1]
    },
    "maxAngleDeg": 90
  },
  "section2": {
    "node": "section_2_root",
    "axisMapping": {
      "up": [1, 0, 0],
      "right": [0, 0, -1],
      "down": [-1, 0, 0],
      "left": [0, 0, 1]
    },
    "maxAngleDeg": 70
  }
}
```

### 18.4 姿态适配器

```ts
interface RobotPose {
  section1: {
    angleDeg: number;
    direction: "up" | "right" | "down" | "left";
  };
  section2: {
    angleDeg: number;
    direction: "up" | "right" | "down" | "left";
  };
}

interface RobotModelAdapter {
  load(profile: ModelProfile): Promise<void>;
  applyFeedbackPose(pose: RobotPose): void;
  applyTargetPose(pose: RobotPose): void;
  setDebugVisible(visible: boolean): void;
  dispose(): void;
}
```

### 18.5 连续弯曲实现层级

**MVP：** 使用模型节点/骨骼旋转，按方向和角度驱动。

**增强：** 多骨骼分配角度、Constant Curvature 近似、基于段长和曲率生成连续中心线、目标和反馈半透明叠加。

高级运动学不得阻塞首版协议和控制交付。

### 18.6 性能和资源释放

- 使用单个 renderer；
- resize 使用 ResizeObserver；
- 页面不可见时降低或暂停 render loop；
- 模型切换时 dispose geometry/material/texture；
- GLTFLoader 加载失败有错误边界；
- WebGL context lost 时提示恢复；
- 采样高于渲染时只使用最新姿态。

---

## 19. 模拟器设计

### 19.1 Transport 级模拟

模拟器实现 `Transport`：

- 可输出已编码 Legacy V1 字节流；
- 可接收真实命令帧；
- 可返回状态变化；
- 可制造拆包和粘包。

这样可同时测试 transport、parser 和 device runtime。

### 19.2 领域级模拟

为控制算法提供直接 `DeviceSnapshot` 序列，便于确定性单测。

### 19.3 简化动力学

```text
target motor position
  → first-order lag
  → pressure channel response
  → bend angle response
  → state frame
```

参数可配置：响应时间、噪声、饱和、死区、延迟和丢帧率。

### 19.4 场景文件

```yaml
name: cycle_life_normal
seed: 42
devices:
  - id: sim-1
    rate_hz: 100
timeline:
  - at_ms: 0
    action: connect
  - at_ms: 1000
    action: enable
faults:
  - at_ms: 30000
    type: checksum_error
    count: 3
```

场景可用于 E2E 和回归测试。

---

## 20. 错误模型

### 20.1 错误码分类

```text
AUTH_*
SERIAL_*
PROTOCOL_*
DEVICE_*
CONTROL_*
SESSION_*
STORAGE_*
MODEL3D_*
CONFIG_*
MIGRATION_*
INTERNAL_*
```

示例：

- `SERIAL_PORT_BUSY`
- `SERIAL_PERMISSION_DENIED`
- `PROTOCOL_CHECKSUM_MISMATCH`
- `DEVICE_NOT_ENABLED`
- `CONTROL_INTERLOCK_BLOCKED`
- `SESSION_WRITE_FAILED`
- `MODEL3D_NODE_NOT_FOUND`

### 20.2 用户提示

错误包含简短标题、用户可理解原因、推荐处理、是否可重试和诊断 ID。内部堆栈只写日志，不直接暴露给普通用户。

---

## 21. 配置与 Schema

配置类型：

- AppSettings；
- SerialProfile；
- ReconnectPolicy；
- FilterProfile；
- ControlProfile；
- CycleControlProfile；
- ModelProfile；
- ThemeProfile；
- WorkspaceLayout；
- LogRetentionPolicy。

每个配置包含：

```json
{
  "schemaVersion": 1,
  "id": "...",
  "name": "...",
  "updatedAt": "..."
}
```

Rust 使用 `schemars` 生成 JSON Schema；导入时先校验再应用。

---

## 22. 线程、异步与背压

### 22.1 任务分配

| 工作 | 执行位置 |
|---|---|
| 串口阻塞读 | 独立 blocking worker |
| 帧解析 | Rust task |
| 控制状态机 | Rust task |
| SQLite 批量写 | 专用 writer task |
| CSV 导出 | blocking task + 流式输出 |
| 日志 | tracing non-blocking writer |
| React UI | WebView 主线程 |
| uPlot | WebView 主线程，限帧 |
| Three.js | requestAnimationFrame，限帧 |

### 22.2 背压原则

1. 控制与安全命令不可因图表阻塞；
2. UI 批次可以合并并保留最新；
3. 会话写入队列接近满时发告警；
4. 会话记录不得无声丢数据；
5. 原始诊断日志可按策略降级；
6. 每个队列暴露容量指标。

### 22.3 取消

关闭设备流程：

```text
mark Closing
  → reject new commands
  → cancel control
  → flush/stop session attachment
  → cancel parser
  → close transport
  → await tasks with timeout
  → force abort only as last resort
  → remove registry entry
```

---

## 23. 测试策略

### 23.1 Rust 单元测试

必须覆盖：

1. 校验和；
2. 命令帧编码；
3. 状态帧解码；
4. 拆包/粘包；
5. 错帧恢复；
6. 中值滤波；
7. 限幅滤波；
8. PID；
9. 闭环状态机；
10. 权限 guard；
11. 配置校验；
12. CSV 格式；
13. 旧用户哈希升级。

### 23.2 属性测试

使用 `proptest`：

- 任意噪声输入不得 panic；
- 任意切片方式下合法帧解析结果一致；
- 编码后的命令长度与长度字段一致；
- checksum 改动能被检测；
- 超范围数据不会溢出。

### 23.3 Golden tests

```text
fixtures/protocol/
├─ valid_status_single_motor.hex
├─ valid_status_multi_device.hex
├─ invalid_checksum.hex
├─ split_frames.json
├─ motor_command_cases.json
├─ bend_command_cases.json
└─ legacy_python_expected.json
```

新 Rust 结果必须与已确认旧版结果一致。

### 23.4 集成测试

1. Simulator Transport → Parser → Snapshot；
2. Snapshot → Control → Encoded Command；
3. Session write → reopen → export；
4. Device disconnect → task cleanup；
5. Auth → permission command；
6. Migration → report；
7. Diagnostics bundle。

### 23.5 前端测试

- 表单校验；
- 权限显示；
- 设备切换；
- 快照 store；
- 图表 buffer；
- Three.js adapter 的节点绑定；
- 事件监听 cleanup；
- 错误提示。

### 23.6 E2E

使用 Playwright + 模拟器：

1. 启动；
2. 登录；
3. 连接模拟设备；
4. 使能；
5. 发送电机命令；
6. 发送两段弯曲；
7. 启动循环检测；
8. 查看曲线；
9. 查看 3D；
10. 录制会话；
11. 停止和回放；
12. 导出 CSV；
13. 查看日志；
14. 导出诊断包；
15. 断线故障注入；
16. 紧急停止。

### 23.7 真机验收

- Windows 真机串口；
- Linux 真机串口；
- 断电/拔线；
- 连续运行 2 小时；
- 多设备；
- 紧急停止；
- 旧版和新版命令对比；
- 数据导出对比。

---

## 24. CI/CD 与代码质量

### 24.1 CI

每次 Pull Request：

```text
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test --workspace
pnpm lint
pnpm typecheck
pnpm test
pnpm build
contract generation diff check
```

主分支增加：E2E 模拟器测试、Windows 打包、Linux 打包、SBOM、安装包 checksum 和正式发布签名。

### 24.2 版本

使用 SemVer，并分别记录：

- 应用版本；
- 协议 adapter 版本；
- 配置 schema 版本；
- 会话格式版本；
- 诊断包格式版本。

版本写入 About、日志、会话元数据、CSV 元数据、诊断包和安装包。

---

## 25. 打包与发布

### 25.1 Windows

- Tauri NSIS 或 MSI；
- WebView2 策略按目标环境确认；
- 模型和默认配置作为资源打包；
- 安装后创建应用数据目录；
- 卸载默认保留用户实验数据；
- 正式包签名。

### 25.2 Linux

目标格式：`.deb`，AppImage 作为兼容性验证后的可选格式。文档明确 WebKitGTK 和系统依赖。

### 25.3 离线要求

- 所有 JS/CSS/模型本地；
- 不访问 CDN；
- 不依赖在线字体；
- 安装包可在无网络环境安装和运行；
- 更新以离线安装包为首要方式。

---

## 26. 迁移实施方案

### Phase 0：基线冻结

1. 标记旧版代码版本；
2. 收集真实上下行帧；
3. 导出旧版协议期望结果；
4. 记录所有 UI 功能；
5. 确认硬件安全参数；
6. 建立迁移测试数据。

输出：`protocol-v1.md`、golden fixtures、功能对照表和风险清单。

### Phase 1：工程骨架

1. 创建 Tauri 2 + React + TS；
2. 创建 Rust workspace；
3. 日志、错误、配置；
4. TypeScript contract 生成；
5. 基础登录壳和主布局；
6. CI。

### Phase 2：模拟器与协议

1. Transport trait；
2. 模拟器；
3. Legacy V1 codec；
4. 协议测试；
5. snapshot；
6. 原始帧调试。

### Phase 3：真实串口与多设备

1. 端口扫描；
2. worker；
3. registry；
4. 握手；
5. 重连；
6. 生命周期清理；
7. 连接 UI。

### Phase 4：控制

1. 安全状态机；
2. 电机；
3. 校准；
4. 归中；
5. 两段弯曲；
6. 主动控制；
7. PID 和循环检测；
8. 命令追踪。

### Phase 5：数据与可视化

1. 状态卡；
2. 实时表格；
3. uPlot；
4. 会话写入；
5. CSV；
6. 历史加载；
7. 回放。

### Phase 6：3D

1. GLB 资源；
2. 模型 profile；
3. 节点绑定；
4. 目标/反馈姿态；
5. 回放联动；
6. 性能和资源释放。

### Phase 7：认证、日志、诊断和迁移

1. Argon2id；
2. 角色；
3. 审计；
4. 日志页面；
5. 诊断包；
6. 旧用户/CSV/配置迁移。

### Phase 8：对齐与发布

1. 功能差异清零；
2. 真机并行测试；
3. 长稳；
4. 安装包；
5. 文档；
6. 发布；
7. 回退预案。

---

## 27. 新旧模块映射

| PyQt5 模块 | 新架构 |
|---|---|
| `main.py` | Tauri bootstrap + React App |
| `Core/auth.py` | `softui-auth` + auth commands |
| `Core/serial_worker.py` | `softui-transport` |
| `Core/protocol.py` | `softui-protocol` |
| `Core/logger.py` | tracing + `softui-diagnostics` |
| `Core/GraphController.py` | session/query service + frontend uPlot |
| `UI/main_window.py` | React app shell |
| `UI/device_tab.py` | device/control Rust services + React feature modules |
| `UI/graph_window.py` | charts page |
| `UI/Local3DViewer.py` | Three.js model page |
| `UI/styles.py` | design tokens |
| `UI/widgets.py` | React component library |
| `Utils/controller.py` | `softui-control::pid` |

注意：不是逐文件翻译，而是按职责拆分。

---

## 28. 编码约束

1. Rust 禁止在业务代码中广泛使用 `unwrap()`；
2. 前端开启 TypeScript strict；
3. 公共 Rust 类型生成 TS，避免手工重复；
4. UI 不拼接协议字节；
5. 协议不引用 UI 类型；
6. 控制算法不引用 Tauri；
7. 所有队列有容量；
8. 所有后台任务可取消；
9. 所有订阅有 unlisten/dispose；
10. 所有资源路径使用系统 path API；
11. 不信任前端参数；
12. 所有危险参数在 Rust 校验；
13. 所有错误带 code；
14. 所有用户可见字符串集中；
15. 配置不得无版本；
16. 日志不得包含密码；
17. 不加载远程脚本；
18. 不在 React 全局 store 保存无限样本；
19. 测试 fixture 不依赖真实用户目录；
20. 每个重要架构变化写 ADR。

---

## 29. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| 现有协议文档不完整 | 解析或控制错误 | 真实帧、旧代码和硬件三方校验；golden tests |
| 传感器字段语义混用 | UI 与闭环错误 | 领域层中性 channel；配置别名；冻结单位表 |
| 闭环逻辑散落在旧 UI | 重写行为不一致 | 提取状态机；录制输入输出；回放对比 |
| 串口阻塞行为跨平台不同 | 断线/关闭卡住 | 独立 worker、超时、取消、平台测试 |
| 高频事件压垮 WebView | UI 卡顿 | Rust 聚合、批量事件、typed array、限帧 |
| 3D 模型节点不规范 | 无法联动 | 模型 profile、节点验证器、调试 HUD |
| 旧账号安全性弱 | 密码泄露 | 首次登录升级 Argon2id；安全凭据 |
| 会话数据量大 | 写盘或查询慢 | SQLite 批量写、索引、流式导出、降采样显示 |
| 一次性重写风险 | 现场不可用 | 渐进迁移、旧版保留、并行运行、回退包 |
| Tauri/Linux WebView 差异 | Linux UI/3D 问题 | Linux CI 和真机测试；明确次级支持范围 |

---

## 30. Definition of Done

技术实现完成必须满足：

1. `cargo test --workspace` 通过；
2. 前端 lint、typecheck、unit test 通过；
3. E2E 模拟器流程通过；
4. golden protocol tests 通过；
5. 无 Clippy warning；
6. 关键后台任务可取消并有测试；
7. 串口断线不会卡死；
8. 紧急停止优先级测试通过；
9. 会话异常恢复测试通过；
10. CSV 与元数据验证通过；
11. Three.js 模型资源释放验证；
12. 权限绕过测试通过；
13. 诊断包脱敏测试通过；
14. Windows 干净机安装通过；
15. 真机关键控制通过；
16. 旧版数据迁移通过；
17. 文档、schema、版本号和安装包一致；
18. 有明确回退版本。

---

# 附录 A：建议领域类型

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct DeviceSnapshot {
    pub schema_version: u32,
    pub device_id: DeviceId,
    pub connection_id: ConnectionId,
    pub received_at_ms: i64,
    pub sequence: u64,
    pub protocol_version: String,
    pub system_enabled: bool,
    pub motors: Vec<MotorState>,
    pub sensors: Vec<SensorState>,
    pub bend: BendSnapshot,
    pub quality: FrameQuality,
}
```

```rust
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub enum DeviceCommand {
    Enable,
    Disable,
    EmergencyStop,
    ResetEmergency,
    Motor(MotorCommand),
    Home,
    SensorCalibration(SensorCalibrationCommand),
    Bend(BendCommand),
    ActiveControl { enabled: bool },
}
```

---

# 附录 B：建议首版性能预算

| 模块 | 预算 |
|---|---|
| 串口读取 | 持续，不阻塞 UI |
| 协议解析 | 单帧远低于采样周期 |
| 快照推送 | 每设备 10–30 Hz |
| 图表批次 | 10–20 批/秒 |
| 图表渲染 | 15–30 FPS |
| 3D 渲染 | 30 FPS 目标 |
| 数据库提交 | 100–1000 行/批，按时间或数量提交 |
| 日志 UI | 分页，每页 100–500 条 |
| 前端表格 | 最近 500–2000 行 |
| 原始诊断缓存 | 最近约 1000 帧 |

具体值通过性能测试调整，原则是采集和控制优先于显示。

---

# 附录 C：首批 ADR

建议创建：

1. ADR-001：选择 Tauri 2 而非 Electron/PyQt；
2. ADR-002：硬件与控制逻辑放在 Rust；
3. ADR-003：采用 Legacy Protocol Adapter；
4. ADR-004：SQLite 会话存储；
5. ADR-005：uPlot 实时图表；
6. ADR-006：Three.js + GLB；
7. ADR-007：Argon2id + OS Credential Store；
8. ADR-008：Rust 类型生成 TypeScript；
9. ADR-009：有界队列和批量 UI 事件；
10. ADR-010：渐进迁移和并行运行。

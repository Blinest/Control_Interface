import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Cable,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  Fingerprint,
  ListChecks,
  Logs,
  PauseCircle,
  Play,
  RefreshCw,
  Save,
  Settings2,
  SlidersHorizontal,
  SunMedium,
  Table2,
  Wifi,
} from "lucide-react";
import { HashRouter } from "react-router-dom";

import { AppRouter } from "./app/AppRouter";
import { AppShell } from "./app/AppShell";
import ChartsPage from "./charts";
import ConnectDialog from "./components/ConnectDialog";
import DeviceCard from "./components/DeviceCard";
import PlaybackBar from "./components/PlaybackBar";
import { ConfirmDialog } from "./components/feedback/ConfirmDialog";
import {
  createConfirmationSafetyContext,
  getLatchedDeviceIds,
  resolveRecoveryDeviceId,
  shouldInvalidateConfirmation,
} from "./features/device-workspace/deviceSafety";
import { useSafeCommand } from "./features/device-workspace/useSafeCommand";
import type { CommandKind } from "./services/commandPolicy";
import { tauriClient } from "./services/tauriClient";
import { reconcileDeviceRefresh, selectCurrentDevice } from "./state/deviceSelectionStore";
import { makeFallbackSnapshot } from "./state/fallbackSnapshot";
import { applyTheme, readThemePreference, resolveTheme, writeThemePreference } from "./state/themeStore";
import SessionsPage from "./pages/SessionsPage";
import type {
  CalibrationStep,
  AuthSession,
  ConnectDeviceRequest,
  ConnectionProfile,
  DeviceConnectionRecord,
  DeviceRuntimeStatusView,
  LogLevel,
  LegacyMigrationPreview,
  LegacyMigrationReport,
  PlaybackStatus,
  RecorderStatus,
  Role,
  RuntimeSnapshot,
  SerialPortDescriptor,
  SessionInfo,
  ThemeMode,
  UserAccount,
} from "./softuiTypes";

function isoShort(ms: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

function isoFull(ms: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(ms));
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function resolveThemeForUser(username: string): ThemeMode {
  return resolveTheme(
    readThemePreference(username),
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );
}

function toneForLevel(level: LogLevel) {
  switch (level) {
    case "warn":
      return "warn";
    case "error":
      return "error";
    case "debug":
      return "neutral";
    default:
      return "info";
  }
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" | "error" | "info" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

function Panel({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <section className={`panel ${wide ? "wide" : ""}`}>
      <div className="panel-head">
        <div>
          <div className="panel-kicker">{subtitle}</div>
          <h2>{title}</h2>
        </div>
        <div className="panel-action">
          {action ?? (Icon ? <Icon size={16} /> : null)}
        </div>
      </div>
      {children}
    </section>
  );
}

function LoginPage({
  theme,
  error,
  busy,
  mustChangePassword,
  onLogin,
  onChangePassword,
}: {
  theme: ThemeMode;
  error: string | null;
  busy: boolean;
  mustChangePassword: boolean;
  onLogin: (username: string, password: string) => Promise<void>;
  onChangePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}) {
  const [username, setUsername] = useState(() => localStorage.getItem("softui:lastUsername") ?? "admin");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    await onLogin(username, password);
  };

  const submitPasswordChange = async (event: FormEvent) => {
    event.preventDefault();
    await onChangePassword(password, newPassword);
    setPassword("");
    setNewPassword("");
  };

  return (
    <div className={`login-shell theme-${theme}`}>
      <section className="login-panel">
        <div className="brand-mark login-mark">
          <Fingerprint size={22} />
        </div>
        <div>
          <div className="section-label">SoftUI</div>
          <h1>上位机登录</h1>
          <p>请先完成本地认证，再进入设备控制工作区。</p>
        </div>

        {!mustChangePassword ? (
          <form className="auth-form" onSubmit={submitLogin}>
            <label>
              <span>用户名</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </label>
            <label>
              <span>密码</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </label>
            {error ? <div className="auth-error">{error}</div> : null}
            <button type="submit" className="primary-btn full" disabled={busy || !username.trim() || !password}>
              <CheckCircle2 size={16} />
              <span>{busy ? "登录中" : "登录"}</span>
            </button>
            <div className="auth-hint">首次安装默认管理员为 admin / admin123，登录后必须修改密码。</div>
          </form>
        ) : (
          <form className="auth-form" onSubmit={submitPasswordChange}>
            <label>
              <span>当前密码</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </label>
            <label>
              <span>新密码</span>
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" />
            </label>
            {error ? <div className="auth-error">{error}</div> : null}
            <button type="submit" className="primary-btn full" disabled={busy || !password || newPassword.length < 8}>
              <CheckCircle2 size={16} />
              <span>{busy ? "提交中" : "修改密码并进入"}</span>
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

type WorkspacePane = "overview" | "table" | "control" | "history";
type SystemControlAction = "enable" | "disable" | "emergencyStop";
type WorkspaceCommand = "home" | "calibrateSensor" | "bend" | "activeTick";
type MotorCommandDraft = {
  motorId: number;
  positionMm: number;
  velocityMmPerSec: number;
  accelerationMmPerSec2: number;
};
type WorkspaceCommandPayload = {
  sensorId?: number;
  calibrationValue?: number;
  direction1?: number;
  angle1Deg?: number;
  direction2?: number;
  angle2Deg?: number;
};

function WorkspacePage({
  snapshot,
  serialPorts,
  serialPortsError,
  connectedDevices,
  deviceStatuses,
  motionLocked,
  connectionError,
  onOpenConnectDialog,
  onDisconnectDevice,
  onRefreshSerialPorts,
  onSystemControl,
  onSendMotor,
  onWorkspaceCommand,
}: {
  snapshot: RuntimeSnapshot;
  serialPorts: SerialPortDescriptor[];
  serialPortsError: string | null;
  connectedDevices: DeviceConnectionRecord[];
  deviceStatuses: Record<string, DeviceRuntimeStatusView>;
  motionLocked: boolean;
  connectionError: string | null;
  onOpenConnectDialog: () => void;
  onDisconnectDevice: (deviceId: string) => void;
  onRefreshSerialPorts: () => void;
  onSystemControl: (action: SystemControlAction) => void;
  onSendMotor: (command: MotorCommandDraft) => void;
  onWorkspaceCommand: (command: WorkspaceCommand, payload?: WorkspaceCommandPayload) => void;
}) {
  const [pane, setPane] = useState<WorkspacePane>("overview");
  const [motorDraft, setMotorDraft] = useState<MotorCommandDraft>({
    motorId: 1,
    positionMm: 0,
    velocityMmPerSec: 10,
    accelerationMmPerSec2: 3,
  });
  const [motorInlineTargets, setMotorInlineTargets] = useState<Record<number, number>>({});
  const [sensorDraft, setSensorDraft] = useState({ sensorId: 1, calibrationValue: 0 });
  const [bendDraft, setBendDraft] = useState({
    direction1: 0,
    angle1Deg: snapshot.calibration.targetAngles[0],
    direction2: 0,
    angle2Deg: snapshot.calibration.targetAngles[1],
  });
  const latestFrame = snapshot.live.frames[0];
  const activeSession = snapshot.playback.sessions.find((session) => session.id === snapshot.playback.activeSessionId) ?? snapshot.playback.sessions[0];
  const progress = clamp((snapshot.playback.cursorMs / Math.max(snapshot.playback.durationMs, 1)) * 100, 0, 100);
  const motorRows = snapshot.live.frames.flatMap((frame) =>
    frame.motors.map((motor) => ({
      frame,
      motor,
    })),
  );
  const sensorRows = snapshot.live.frames.flatMap((frame) =>
    frame.sensors.map((sensor) => ({
      frame,
      sensor,
    })),
  );
  const sections = [
    { key: "overview" as const, icon: Activity, title: "监控" },
    { key: "table" as const, icon: Table2, title: "表格" },
    { key: "control" as const, icon: SlidersHorizontal, title: "控制" },
    { key: "history" as const, icon: Play, title: "回放" },
  ];

  return (
    <div className="workspace-page">
      <div className="workspace-tabs" role="tablist" aria-label="workspace sections">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <button
              key={section.key}
              type="button"
              className={`workspace-tab ${pane === section.key ? "active" : ""}`}
              onClick={() => setPane(section.key)}
            >
              <Icon size={15} />
              <span>{section.title}</span>
            </button>
          );
        })}
      </div>

      {pane === "overview" ? (
        <div className="page-grid workspace-grid workspace-overview-grid">
          <Panel title="系统操作" subtitle="workspace" icon={Cable} wide>
            <div className="workspace-split">
              <div className="workspace-list">
                <div className="stack-item">
                  <span>连接状态</span>
                  <strong>{snapshot.connection.state}</strong>
                </div>
                <div className="stack-item">
                  <span>当前设备</span>
                  <strong>{snapshot.live.selectedDeviceId}</strong>
                </div>
                <div className="stack-item">
                  <span>采样 / 帧率</span>
                  <strong>
                    {snapshot.dashboard.sampleRateHz} Hz / {snapshot.dashboard.frameRateHz} fps
                  </strong>
                </div>
                <div className="stack-item">
                  <span>握手阶段</span>
                  <strong>{snapshot.connection.handshakeStep}</strong>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${snapshot.connection.handshakeProgress}%` }} />
                </div>
              </div>
              <div className="workspace-list">
                <div className="stack-item">
                  <span>真实串口</span>
                  <strong>{serialPorts.length} 个</strong>
                </div>
                <div className="stack-item">
                  <span>扫描状态</span>
                  <strong>{serialPortsError ?? "ready"}</strong>
                </div>
                <div className="button-stack">
                  <button type="button" className="ghost-btn full" onClick={onRefreshSerialPorts}>
                    <RefreshCw size={16} />
                    <span>扫描串口</span>
                  </button>
                  <button type="button" className="ghost-btn full" onClick={onOpenConnectDialog}>
                    <Wifi size={16} />
                    <span>连接新设备</span>
                  </button>
                  <button
                    type="button"
                    className="ghost-btn full"
                    disabled={motionLocked && snapshot.connection.state !== "ready"}
                    onClick={() => onSystemControl(snapshot.connection.state === "ready" ? "disable" : "enable")}
                  >
                    <CheckCircle2 size={16} />
                    <span>使能 / 失能</span>
                  </button>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="串口发现" subtitle="transport" icon={Cable} wide>
            {connectionError ? (
              <div className="connection-error">
                <AlertTriangle size={14} />
                <span>{connectionError}</span>
              </div>
            ) : null}

            {connectedDevices.length > 0 ? (
              <div className="device-grid" style={{ marginBottom: 10 }}>
                {connectedDevices.map((dev) => (
                  <DeviceCard
                    key={dev.deviceId}
                    device={dev}
                    runtimeStatus={deviceStatuses[dev.deviceId] ?? null}
                    onDisconnect={onDisconnectDevice}
                  />
                ))}
              </div>
            ) : null}

            <button type="button" className="ghost-btn full" onClick={onOpenConnectDialog} style={{ marginBottom: 10 }}>
              <Wifi size={16} />
              <span>连接新设备</span>
            </button>

            <div className="port-list">
              {serialPorts.length === 0 ? (
                <div className="port-card">
                  <div>
                    <strong>未发现真实串口</strong>
                    <span>可继续使用 Simulator；连接硬件后点击刷新串口。</span>
                  </div>
                  <Badge tone="warn">无串口</Badge>
                </div>
              ) : (
                serialPorts.map((port) => (
                  <div className="port-card" key={port.portName}>
                    <div>
                      <strong>{port.portName}</strong>
                      <span>
                        {port.description ?? port.product ?? "Serial port"} · {port.manufacturer ?? port.portType}
                      </span>
                    </div>
                    <div className="port-meta">
                      <Badge tone={port.likelyAvailable ? "ok" : "warn"}>{port.portType.toUpperCase()}</Badge>
                      {port.vid != null && port.pid != null ? (
                        <span>
                          VID {port.vid.toString(16).padStart(4, "0").toUpperCase()} / PID{" "}
                          {port.pid.toString(16).padStart(4, "0").toUpperCase()}
                        </span>
                      ) : (
                        <span>{port.likelyAvailable ? "可用" : "已过滤"}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Panel>
        </div>
      ) : null}

      {pane === "table" ? (
        <div className="page-grid workspace-grid workspace-table-grid">
          <Panel title="电机快照" subtitle="workspace" icon={Table2} wide>
            <div className="data-table scroll">
              <div className="data-row head">
                <span>时间</span>
                <span>帧号</span>
                <span>对象</span>
                <span>位置</span>
                <span>速度</span>
                <span>状态</span>
              </div>
              {motorRows.slice(0, 6).map(({ frame, motor }) => (
                <div className="data-row" key={`${frame.sequence}-${motor.id}`}>
                  <span>{isoShort(frame.receivedAtMs)}</span>
                  <span>#{frame.sequence}</span>
                  <span>电机 {motor.id}</span>
                  <span>{motor.positionMm.toFixed(2)} mm</span>
                  <span>{motor.velocityMmPerSec.toFixed(2)} mm/s</span>
                  <span>
                    <Badge tone={frame.quality.status === "ok" ? "ok" : "warn"}>{frame.quality.status}</Badge>
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="传感器快照" subtitle="workspace" icon={Eye} wide>
            <div className="data-table scroll">
              <div className="data-row head">
                <span>时间</span>
                <span>帧号</span>
                <span>对象</span>
                <span>X</span>
                <span>Y</span>
                <span>Z</span>
              </div>
              {sensorRows.slice(0, 6).map(({ frame, sensor }) => (
                <div className="data-row" key={`${frame.sequence}-sensor-${sensor.id}`}>
                  <span>{isoShort(frame.receivedAtMs)}</span>
                  <span>#{frame.sequence}</span>
                  <span>传感器 {sensor.id}</span>
                  <span>{sensor.filtered[0].toFixed(2)}</span>
                  <span>{sensor.filtered[1].toFixed(2)}</span>
                  <span>{sensor.filtered[2].toFixed(2)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}

      {pane === "control" ? (
        <div className="page-grid workspace-grid workspace-control-grid">
          <Panel title="系统状态" subtitle="工作区" icon={Activity} wide>
            {motionLocked ? (
              <div className="motion-lock-reason" role="status">
                <AlertTriangle size={15} />
                <span>急停已锁定，全部运动控制已禁用。</span>
              </div>
            ) : null}
            <div className="status-strip">
              <div className="status-strip-item">
                <span className="status-strip-label">连接状态</span>
                <Badge tone={snapshot.connection.state === "ready" ? "ok" : snapshot.connection.state === "error" ? "error" : "warn"}>
                  {snapshot.connection.state === "ready" ? "已连接" : snapshot.connection.state === "idle" ? "空闲" : snapshot.connection.state === "connecting" ? "连接中" : snapshot.connection.state === "error" ? "错误" : snapshot.connection.state}
                </Badge>
              </div>
              <div className="status-strip-item">
                <span className="status-strip-label">使能状态</span>
                <Badge tone={latestFrame.systemEnabled ? "ok" : "warn"}>
                  {latestFrame.systemEnabled ? "已使能" : "已失能"}
                </Badge>
              </div>
              <div className="status-strip-item">
                <span className="status-strip-label">设备</span>
                <strong>{snapshot.live.selectedDeviceId}</strong>
              </div>
              <div className="status-strip-actions">
                <button type="button" className="ghost-btn" disabled={motionLocked} onClick={() => onSystemControl("enable")}>
                  <CheckCircle2 size={15} />
                  <span>使能</span>
                </button>
                <button type="button" className="ghost-btn" onClick={() => onSystemControl("disable")}>
                  <PauseCircle size={15} />
                  <span>失能</span>
                </button>
              </div>
            </div>
          </Panel>

          <Panel title="电机控制与状态" subtitle="工作区" icon={ArrowRightLeft} wide>
            <div className="motor-inline-bar">
              <label>
                <span>通道</span>
                <input type="number" min={1} max={6} value={motorDraft.motorId}
                  onChange={(event) => setMotorDraft((draft) => ({ ...draft, motorId: Number(event.target.value) }))} />
              </label>
              <label>
                <span>目标 mm</span>
                <input type="number" step={0.1} value={motorDraft.positionMm}
                  onChange={(event) => setMotorDraft((draft) => ({ ...draft, positionMm: Number(event.target.value) }))} />
              </label>
              <label>
                <span>速度</span>
                <input type="number" min={0} step={0.1} value={motorDraft.velocityMmPerSec}
                  onChange={(event) => setMotorDraft((draft) => ({ ...draft, velocityMmPerSec: Number(event.target.value) }))} />
              </label>
              <label>
                <span>加速度</span>
                <input type="number" min={0} step={0.1} value={motorDraft.accelerationMmPerSec2}
                  onChange={(event) => setMotorDraft((draft) => ({ ...draft, accelerationMmPerSec2: Number(event.target.value) }))} />
              </label>
              <button type="button" className="ghost-btn" disabled={motionLocked} onClick={() => onSendMotor(motorDraft)}>
                <ArrowRightLeft size={14} />
                <span>发送</span>
              </button>
            </div>
            <div className="motor-control-grid">
              {latestFrame.motors.map((motor) => (
                <article className="motor-control-card" key={motor.id}>
                  <div className="motor-control-head">
                    <strong>电机 {motor.id}</strong>
                    <Badge tone={motor.running ? "ok" : "warn"}>{motor.running ? "运行" : "停止"}</Badge>
                  </div>
                  <div className="motor-control-values">
                    <div>
                      <span>当前位置</span>
                      <strong>{motor.positionMm.toFixed(1)} mm</strong>
                    </div>
                    <div>
                      <span>目标位置</span>
                      <input
                        type="number" step={0.1}
                        className="motor-target-input"
                        value={motorInlineTargets[motor.id] ?? motor.targetPositionMm}
                        onChange={(event) => setMotorInlineTargets((prev) => ({ ...prev, [motor.id]: Number(event.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="motor-control-actions">
                    <button type="button" className="ghost-btn" disabled={motionLocked}
                      onClick={() => onSendMotor({ motorId: motor.id, positionMm: motorInlineTargets[motor.id] ?? motor.targetPositionMm, velocityMmPerSec: Math.max(motor.velocityMmPerSec, 1), accelerationMmPerSec2: Math.max(motor.accelerationMmPerSec2, 1) })}>
                      <ArrowRightLeft size={14} />
                      <span>发送</span>
                    </button>
                    <button type="button" className="ghost-btn" onClick={() => onSystemControl("disable")}>
                      <PauseCircle size={14} />
                      <span>停机</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="传感器校准" subtitle="工作区" icon={CheckCircle2}>
            <div className="command-form">
              <span className="command-form-title">校准参数</span>
              <label>
                <span>传感器</span>
                <input type="number" min={1} max={6} value={sensorDraft.sensorId}
                  onChange={(event) => setSensorDraft((draft) => ({ ...draft, sensorId: Number(event.target.value) }))} />
              </label>
              <label>
                <span>校准值</span>
                <input type="number" step={0.01} value={sensorDraft.calibrationValue}
                  onChange={(event) => setSensorDraft((draft) => ({ ...draft, calibrationValue: Number(event.target.value) }))} />
              </label>
              <button type="button" className="ghost-btn full" onClick={() => onWorkspaceCommand("calibrateSensor", sensorDraft)}>
                <CheckCircle2 size={15} />
                <span>发送校准</span>
              </button>
            </div>
            <div className="workspace-list" style={{ marginTop: 12 }}>
              {snapshot.calibration.steps.map((step: CalibrationStep) => (
                <div className={`step-item ${step.done ? "done" : ""} ${step.active ? "active" : ""}`} key={step.id}>
                  <span className="step-index">{step.id}</span>
                  <div className="step-copy">
                    <strong>{step.label}</strong>
                    <span>{step.done ? "已完成" : step.active ? "进行中" : "待处理"}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="弯曲与主动控制" subtitle="工作区" icon={ArrowRightLeft}>
            <div className="command-form">
              <span className="command-form-title">弯曲命令</span>
              <label>
                <span>方向1</span>
                <select value={bendDraft.direction1}
                  onChange={(event) => setBendDraft((draft) => ({ ...draft, direction1: Number(event.target.value) }))}>
                  <option value={0}>上</option>
                  <option value={1}>下</option>
                  <option value={2}>左</option>
                  <option value={3}>右</option>
                </select>
              </label>
              <label>
                <span>角度1</span>
                <input type="number" min={0} max={90} step={0.1} value={bendDraft.angle1Deg}
                  onChange={(event) => setBendDraft((draft) => ({ ...draft, angle1Deg: Number(event.target.value) }))} />
              </label>
              <label>
                <span>方向2</span>
                <select value={bendDraft.direction2}
                  onChange={(event) => setBendDraft((draft) => ({ ...draft, direction2: Number(event.target.value) }))}>
                  <option value={0}>上</option>
                  <option value={1}>下</option>
                  <option value={2}>左</option>
                  <option value={3}>右</option>
                </select>
              </label>
              <label>
                <span>角度2</span>
                <input type="number" min={0} max={90} step={0.1} value={bendDraft.angle2Deg}
                  onChange={(event) => setBendDraft((draft) => ({ ...draft, angle2Deg: Number(event.target.value) }))} />
              </label>
              <button type="button" className="ghost-btn full" disabled={motionLocked} onClick={() => onWorkspaceCommand("bend", bendDraft)}>
                <ArrowRightLeft size={15} />
                <span>发送弯曲</span>
              </button>
            </div>
            <div className="button-stack" style={{ marginTop: 12 }}>
              <button type="button" className="ghost-btn full" disabled={motionLocked} onClick={() => onWorkspaceCommand("home")}>
                <ArrowRightLeft size={16} />
                <span>一键归中</span>
              </button>
              <button type="button" className="ghost-btn full" disabled={motionLocked} onClick={() => onWorkspaceCommand("activeTick")}>
                <Activity size={16} />
                <span>主动控制</span>
              </button>
            </div>
          </Panel>
        </div>
      ) : null}

      {pane === "history" ? (
        <div className="page-grid workspace-grid">
          <Panel title="会话与回放" subtitle="workspace" icon={Play} wide>
            <div className="timeline">
              <div className="timeline-bar">
                <div className="timeline-fill" style={{ width: `${progress}%` }} />
              </div>
              <div className="timeline-meta">
                <span>{isoFull(snapshot.playback.cursorMs)}</span>
                <span>{snapshot.playback.speed.toFixed(1)}x</span>
                <span>{snapshot.playback.durationMs / 1000}s</span>
              </div>
            </div>
            <div className="mini-info">
              当前会话：<strong>{activeSession?.name}</strong>
            </div>
          </Panel>

          <Panel title="会话列表" subtitle="workspace" icon={Database}>
            <div className="stack-list">
              {snapshot.playback.sessions.map((session) => (
                <div className="stack-item" key={session.id}>
                  <span>{session.name}</span>
                  <strong>{session.recordCount.toLocaleString()} 条记录</strong>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="最近日志" subtitle="workspace" icon={Logs} wide>
            <div className="log-list compact">
              {snapshot.logs.slice(0, 4).map((entry) => (
                <div className="log-row" key={entry.id}>
                  <Badge tone={toneForLevel(entry.level)}>{entry.level.toUpperCase()}</Badge>
                  <span className="log-scope">{entry.scope}</span>
                  <span className="log-message">{entry.message}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}

function AppController() {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>(makeFallbackSnapshot);
  const [currentDeviceId, setCurrentDeviceId] = useState(() => localStorage.getItem("softui:currentDeviceId") ?? "");
  const currentDeviceIdRef = useRef(currentDeviceId);
  const connectedDevicesRefreshIdRef = useRef(0);
  const [serialPorts, setSerialPorts] = useState<SerialPortDescriptor[]>([]);
  const [serialPortsError, setSerialPortsError] = useState<string | null>(null);
  const [connectedDevices, setConnectedDevices] = useState<DeviceConnectionRecord[]>([]);
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, DeviceRuntimeStatusView>>({});
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [connectionProfiles, setConnectionProfiles] = useState<ConnectionProfile[]>([]);
  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>({ active: false, sessionId: "", sessionName: "", frameCount: 0, elapsedSecs: 0, paused: false });
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [playbackStatus, setPlaybackStatus] = useState<PlaybackStatus | null>(null);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [diagnosticsPath, setDiagnosticsPath] = useState("");
  const [migrationSource, setMigrationSource] = useState("");
  const [migrationPreview, setMigrationPreview] = useState<LegacyMigrationPreview | null>(null);
  const [migrationReport, setMigrationReport] = useState<LegacyMigrationReport | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const safeCommand = useSafeCommand();
  const latchedDeviceIds = getLatchedDeviceIds(deviceStatuses);
  const emergencyLatched = snapshot.runtimeDiagnostics.emergencyLatched || latchedDeviceIds.length > 0;
  const confirmationSafetyContext = createConfirmationSafetyContext(
    currentDeviceId,
    snapshot.runtimeDiagnostics.emergencyLatched,
    deviceStatuses,
    connectedDevices.map((device) => device.deviceId),
  );
  const previousConfirmationSafetyContextRef = useRef(confirmationSafetyContext);

  useEffect(() => {
    const previousContext = previousConfirmationSafetyContextRef.current;
    previousConfirmationSafetyContextRef.current = confirmationSafetyContext;
    if (shouldInvalidateConfirmation(previousContext, confirmationSafetyContext)) safeCommand.cancel();
  }, [
    confirmationSafetyContext.aggregateEmergencyLatched,
    confirmationSafetyContext.connectedDeviceTopology,
    confirmationSafetyContext.deviceLatchState,
    confirmationSafetyContext.selectedDeviceId,
    safeCommand.cancel,
  ]);

  const setCurrentDevice = useCallback((deviceId: string) => {
    selectCurrentDevice(deviceId);
    currentDeviceIdRef.current = deviceId;
    setCurrentDeviceId(deviceId);
    setSnapshot((previous) => ({
      ...previous,
      live: { ...previous.live, selectedDeviceId: deviceId },
    }));
  }, []);

  const fetchSnapshot = useCallback(async (mode: "bootstrap_state" | "tick_snapshot" = "bootstrap_state") => {
    try {
      const next = mode === "bootstrap_state"
        ? await tauriClient.bootstrap()
        : await tauriClient.tick();
      setSnapshot((previous) => {
        const theme = next.authSession.authenticated
          ? resolveThemeForUser(next.authSession.username)
          : previous.theme;
        return {
          ...next,
          live: { ...next.live, selectedDeviceId: currentDeviceIdRef.current },
          theme,
          settings: { ...next.settings, theme },
        };
      });
    } catch (invokeError) {
      console.error(invokeError);
    }
  }, []);

  useEffect(() => {
    void fetchSnapshot("bootstrap_state");
  }, [fetchSnapshot]);

  useEffect(() => {
    applyTheme(snapshot.theme);
  }, [snapshot.theme]);

  const refreshSerialPorts = useCallback(async () => {
    try {
      const ports = await tauriClient.invoke<SerialPortDescriptor[]>("list_serial_ports");
      setSerialPorts(ports);
      setSerialPortsError(null);
    } catch (invokeError) {
      setSerialPorts([]);
      setSerialPortsError(invokeError instanceof Error ? invokeError.message : "Unable to scan serial ports");
    }
  }, []);

  useEffect(() => {
    void refreshSerialPorts();
  }, [refreshSerialPorts]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void fetchSnapshot("tick_snapshot");
    }, 1000);
    return () => window.clearInterval(timer);
  }, [fetchSnapshot]);

  // Poll connected devices list
  const refreshConnectedDevices = useCallback(async () => {
    const refreshId = ++connectedDevicesRefreshIdRef.current;
    try {
      const devices = await tauriClient.invoke<DeviceConnectionRecord[]>("list_connected_devices");
      const reconciledDeviceId = reconcileDeviceRefresh(
        refreshId,
        connectedDevicesRefreshIdRef.current,
        currentDeviceIdRef.current,
        devices.map((device) => device.deviceId),
      );
      if (reconciledDeviceId === null) return;

      setConnectedDevices(devices);
      if (reconciledDeviceId !== currentDeviceIdRef.current) setCurrentDevice(reconciledDeviceId);

      // Fetch runtime status for each device (skip simulator)
      const statuses: Record<string, DeviceRuntimeStatusView> = {};
      for (const d of devices) {
        if (d.deviceId.startsWith("serial:")) {
          try {
            const s = await tauriClient.invoke<DeviceRuntimeStatusView>("device_runtime_status", { deviceId: d.deviceId });
            statuses[d.deviceId] = s;
          } catch { /* ignore */ }
        }
      }
      if (refreshId !== connectedDevicesRefreshIdRef.current) return;
      setDeviceStatuses(statuses);
    } catch { /* ignore */ }
  }, [setCurrentDevice]);

  useEffect(() => {
    void refreshConnectedDevices();
    const interval = setInterval(() => { void refreshConnectedDevices(); }, 1000);
    return () => clearInterval(interval);
  }, [refreshConnectedDevices]);

  // Load connection profiles
  const refreshConnectionProfiles = useCallback(async () => {
    try {
      const profiles = await tauriClient.invoke<ConnectionProfile[]>("list_connection_profiles");
      setConnectionProfiles(profiles);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void refreshConnectionProfiles();
  }, [refreshConnectionProfiles]);

  const refreshUsers = useCallback(async () => {
    try {
      const list = await tauriClient.invoke<UserAccount[]>("list_users");
      setUsers(list);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    void refreshUsers();
  }, [refreshUsers, snapshot.authSession.username, snapshot.authSession.role]);

  const applyAuthSession = useCallback((session: AuthSession) => {
    const theme = session.authenticated ? resolveThemeForUser(session.username) : undefined;
    if (theme) applyTheme(theme);
    setSnapshot((prev) => ({
      ...prev,
      theme: theme ?? prev.theme,
      settings: theme ? { ...prev.settings, theme } : prev.settings,
      authSession: session,
    }));
  }, []);

  const loginUser = useCallback(async (username: string, password: string) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const session = await tauriClient.invoke<AuthSession>("login", {
        request: { username: username.trim(), password },
      });
      localStorage.setItem("softui:lastUsername", username.trim());
      applyAuthSession(session);
      if (!session.mustChangePassword) {
        await fetchSnapshot("tick_snapshot");
        await refreshUsers();
      }
    } catch (invokeError) {
      setAuthError(invokeError instanceof Error ? invokeError.message : String(invokeError));
    } finally {
      setAuthBusy(false);
    }
  }, [applyAuthSession, fetchSnapshot, refreshUsers]);

  const changeOwnPasswordAfterLogin = useCallback(async (oldPassword: string, newPassword: string) => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await tauriClient.invoke("change_password", {
        request: { username: null, oldPassword, newPassword },
      });
      const session = await tauriClient.invoke<AuthSession>("current_auth_session");
      applyAuthSession(session);
      await fetchSnapshot("tick_snapshot");
      await refreshUsers();
    } catch (invokeError) {
      setAuthError(invokeError instanceof Error ? invokeError.message : String(invokeError));
    } finally {
      setAuthBusy(false);
    }
  }, [applyAuthSession, fetchSnapshot, refreshUsers]);

  const logoutUser = useCallback(async () => {
    try {
      const session = await tauriClient.invoke<AuthSession>("logout");
      applyAuthSession(session);
      setUsers([]);
    } catch (invokeError) {
      console.error(invokeError);
    }
  }, [applyAuthSession]);

  const createUserAccount = useCallback(async (username: string, password: string, role: Role) => {
    await tauriClient.invoke<UserAccount>("create_user", {
      request: { username: username.trim(), password, role },
    });
    await refreshUsers();
  }, [refreshUsers]);

  const resetUserPassword = useCallback(async (username: string, newPassword: string) => {
    await tauriClient.invoke("change_password", {
      request: { username, oldPassword: null, newPassword },
    });
    await refreshUsers();
  }, [refreshUsers]);

  const setUserDisabled = useCallback(async (username: string, disabled: boolean) => {
    await tauriClient.invoke<UserAccount>("set_user_disabled", { username, disabled });
    await refreshUsers();
  }, [refreshUsers]);

  const handleConnectDevice = useCallback(async (request: ConnectDeviceRequest) => {
    await tauriClient.invoke("connect_device", { request });
    setConnectionError(null);
    await refreshConnectedDevices();
  }, [refreshConnectedDevices]);

  const handleDisconnectDevice = useCallback(async (deviceId: string) => {
    try {
      await tauriClient.invoke("disconnect_device", { deviceId });
      await refreshConnectedDevices();
    } catch (e) {
      console.error(e);
    }
  }, [refreshConnectedDevices]);

  const handleSaveProfile = useCallback(async (profile: ConnectionProfile) => {
    await tauriClient.invoke("save_connection_profile", { profile });
    await refreshConnectionProfiles();
  }, [refreshConnectionProfiles]);

  const handleDeleteProfile = useCallback(async (id: string) => {
    await tauriClient.invoke("delete_connection_profile", { id });
    await refreshConnectionProfiles();
  }, [refreshConnectionProfiles]);

  const toggleTheme = useCallback(async () => {
    const nextTheme: ThemeMode = snapshot.theme === "dark" ? "light" : "dark";
    writeThemePreference(snapshot.authSession.username, nextTheme);
    applyTheme(nextTheme);
    try {
      const next = await tauriClient.invoke<RuntimeSnapshot>("set_theme", { theme: nextTheme });
      setSnapshot((prev) => ({
        ...next,
        live: { ...next.live, selectedDeviceId: currentDeviceIdRef.current },
        theme: nextTheme,
        settings: { ...next.settings, theme: nextTheme },
        authSession: next.authSession.authenticated ? next.authSession : prev.authSession,
      }));
    } catch {
      setSnapshot((prev) => ({
        ...prev,
        theme: nextTheme,
        settings: { ...prev.settings, theme: nextTheme },
      }));
    }
  }, [snapshot.authSession.username, snapshot.theme]);

  const exportDiagnostics = useCallback(async () => {
    try {
      const path = await tauriClient.invoke<string>("export_diagnostics_bundle");
      setDiagnosticsPath(path);
    } catch (invokeError) {
      setDiagnosticsPath(invokeError instanceof Error ? invokeError.message : String(invokeError));
    }
  }, []);

  const previewMigration = useCallback(async () => {
    if (!migrationSource.trim()) return;
    try {
      const preview = await tauriClient.invoke<LegacyMigrationPreview>("preview_legacy_migration", {
        sourceDir: migrationSource.trim(),
        targetDir: null,
      });
      setMigrationPreview(preview);
      setMigrationReport(null);
    } catch (invokeError) {
      setMigrationPreview({
        sourceDir: migrationSource.trim(),
        targetDir: "",
        exists: false,
        userFiles: 0,
        configFiles: 0,
        csvFiles: 0,
        logFiles: 0,
        skippedFiles: 0,
        warnings: [invokeError instanceof Error ? invokeError.message : String(invokeError)],
      });
    }
  }, [migrationSource]);

  const runMigration = useCallback(async () => {
    if (!migrationSource.trim()) return;
    try {
      const report = await tauriClient.invoke<LegacyMigrationReport>("run_legacy_migration", {
        sourceDir: migrationSource.trim(),
        targetDir: null,
      });
      setMigrationReport(report);
      setMigrationPreview(report.preview);
      await fetchSnapshot("tick_snapshot");
    } catch (invokeError) {
      setMigrationReport(null);
      setMigrationPreview({
        sourceDir: migrationSource.trim(),
        targetDir: "",
        exists: false,
        userFiles: 0,
        configFiles: 0,
        csvFiles: 0,
        logFiles: 0,
        skippedFiles: 0,
        warnings: [invokeError instanceof Error ? invokeError.message : String(invokeError)],
      });
    }
  }, [fetchSnapshot, migrationSource]);

  const toggleRecording = useCallback(async () => {
    if (recorderStatus.active) {
      await tauriClient.invoke<SessionInfo>("stop_recording");
    } else {
      await tauriClient.invoke<SessionInfo>("start_recording");
    }
    const status = await tauriClient.invoke<RecorderStatus>("recorder_status");
    setRecorderStatus(status);
    const list = await tauriClient.invoke<SessionInfo[]>("list_sessions");
    setSessions(list);
  }, [recorderStatus.active]);

  const pauseRecording = useCallback(async () => {
    try {
      await tauriClient.invoke("pause_recording");
      const status = await tauriClient.invoke<RecorderStatus>("recorder_status");
      setRecorderStatus(status);
    } catch { /* ignore */ }
  }, []);

  const resumeRecording = useCallback(async () => {
    try {
      await tauriClient.invoke("resume_recording");
      const status = await tauriClient.invoke<RecorderStatus>("recorder_status");
      setRecorderStatus(status);
    } catch { /* ignore */ }
  }, []);

  const deleteSession = useCallback(async (id: string) => {
    try {
      await tauriClient.invoke("delete_session", { id });
      const list = await tauriClient.invoke<SessionInfo[]>("list_sessions");
      setSessions(list);
    } catch { /* ignore */ }
  }, []);

  const renameSession = useCallback(async (id: string, name: string) => {
    try {
      await tauriClient.invoke("rename_session", { id, name });
      const list = await tauriClient.invoke<SessionInfo[]>("list_sessions");
      setSessions(list);
    } catch { /* ignore */ }
  }, []);

  const exportCsv = useCallback(async (id: string) => {
    try {
      const path = await tauriClient.invoke<string>("export_session_csv", { id, outputPath: null });
      console.log("CSV exported to:", path);
    } catch (e) { console.error(e); }
  }, []);

  const loadPlayback = useCallback(async (id: string) => {
    try {
      const status = await tauriClient.invoke<PlaybackStatus>("playback_load", { sessionId: id });
      setPlaybackStatus(status);
    } catch (e) { console.error(e); }
  }, []);

  const playbackPlayPause = useCallback(async () => {
    if (!playbackStatus) return;
    try {
      const status = playbackStatus.playing
        ? await tauriClient.invoke<PlaybackStatus>("playback_pause")
        : await tauriClient.invoke<PlaybackStatus>("playback_play");
      setPlaybackStatus(status);
    } catch (e) { console.error(e); }
  }, [playbackStatus]);

  const playbackStop = useCallback(async () => {
    try {
      await tauriClient.invoke<PlaybackStatus>("playback_stop");
      setPlaybackStatus(null);
    } catch (e) { console.error(e); }
  }, []);

  const playbackSeek = useCallback(async (ms: number) => {
    try {
      const status = await tauriClient.invoke<PlaybackStatus>("playback_seek", { ms });
      setPlaybackStatus(status);
    } catch (e) { console.error(e); }
  }, []);

  const playbackSetSpeed = useCallback(async (speed: number) => {
    try {
      const status = await tauriClient.invoke<PlaybackStatus>("playback_set_speed", { speed });
      setPlaybackStatus(status);
    } catch (e) { console.error(e); }
  }, []);

  // Poll recorder status and sessions list every 2 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const status = await tauriClient.invoke<RecorderStatus>("recorder_status");
        setRecorderStatus(status);
        const list = await tauriClient.invoke<SessionInfo[]>("list_sessions");
        setSessions(list);
      } catch { /* ignore */ }
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Poll playback status at 100ms when playback is active
  useEffect(() => {
    if (!playbackStatus?.active) return;
    const interval = setInterval(async () => {
      try {
        const status = await tauriClient.invoke<PlaybackStatus>("playback_status");
        setPlaybackStatus(status);
        if (!status.active) {
          setPlaybackStatus(null);
        }
      } catch {
        setPlaybackStatus(null);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [playbackStatus?.active]);

  const toggleConnection = useCallback(async () => {
    // Open the connect dialog instead of the old toggle behavior
    setConnectionError(null);
    setConnectDialogOpen(true);
  }, []);

  const runSystemControl = useCallback(async (deviceId: string, action: SystemControlAction) => {
    try {
      const next = await tauriClient.submitSystemControl(deviceId, action);
      setSnapshot({
        ...next,
        live: { ...next.live, selectedDeviceId: currentDeviceIdRef.current },
      });
    } catch (invokeError) {
      console.error(invokeError);
    }
  }, []);

  const submitSystemControl = useCallback(async (action: SystemControlAction) => {
    const deviceId = currentDeviceId;
    if (action === "disable") {
      await runSystemControl(deviceId, action);
      return;
    }

    if (action === "enable" && emergencyLatched) return;

    const kind: CommandKind = action === "emergencyStop" ? "emergencyStop" : "enable";
    await safeCommand.execute(kind, { deviceId }, () => runSystemControl(deviceId, action));
  }, [currentDeviceId, emergencyLatched, runSystemControl, safeCommand.execute]);

  const recoverDevice = useCallback(async (requestedDeviceId: string) => {
    const deviceId = resolveRecoveryDeviceId(deviceStatuses, requestedDeviceId);
    if (deviceId === null) return;

    await safeCommand.execute(
      "recover",
      { deviceId },
      () => runSystemControl(deviceId, "enable"),
    );
  }, [deviceStatuses, runSystemControl, safeCommand.execute]);

  const sendMotorCommand = useCallback(async (command: MotorCommandDraft) => {
    if (emergencyLatched) return;

    const request = {
      deviceId: currentDeviceId,
      motorId: command.motorId,
      positionMm: command.positionMm,
      velocityMmPerSec: Math.max(command.velocityMmPerSec, 1),
      accelerationMmPerSec2: Math.max(command.accelerationMmPerSec2, 1),
    };
    await safeCommand.execute("motorMove", request, async () => {
      try {
        const next = await tauriClient.sendMotorCommand(request);
        setSnapshot({
          ...next,
          live: { ...next.live, selectedDeviceId: currentDeviceIdRef.current },
        });
      } catch (invokeError) {
        console.error(invokeError);
      }
    });
  }, [currentDeviceId, emergencyLatched, safeCommand.execute]);

  const submitWorkspaceCommand = useCallback(async (command: WorkspaceCommand, payload: WorkspaceCommandPayload = {}) => {
    const deviceId = currentDeviceId;
    const targetAngles = snapshot.calibration.targetAngles;
    const commandMap: Record<WorkspaceCommand, { kind: CommandKind; name: string; request: Record<string, unknown> }> = {
      home: {
        kind: "home",
        name: "send_home_command",
        request: { deviceId, motorCount: 6, startAddress: 1 },
      },
      calibrateSensor: {
        kind: "calibrate",
        name: "calibrate_sensor",
        request: {
          deviceId,
          sensorId: payload.sensorId ?? 1,
          calibrationValue: payload.calibrationValue ?? 0,
        },
      },
      bend: {
        kind: "bend",
        name: "send_bend_command",
        request: {
          deviceId,
          direction1: payload.direction1 ?? 0,
          angle1Deg: payload.angle1Deg ?? targetAngles[0],
          direction2: payload.direction2 ?? 0,
          angle2Deg: payload.angle2Deg ?? targetAngles[1],
        },
      },
      activeTick: {
        kind: "activeControl",
        name: "send_active_control_tick",
        request: { deviceId },
      },
    };
    const selected = commandMap[command];
    if (emergencyLatched && command !== "calibrateSensor") return;

    await safeCommand.execute(selected.kind, selected.request, async () => {
      try {
        const next = await tauriClient.invoke<RuntimeSnapshot>(selected.name, { request: selected.request });
        setSnapshot({
          ...next,
          live: { ...next.live, selectedDeviceId: currentDeviceIdRef.current },
        });
      } catch (invokeError) {
        console.error(invokeError);
      }
    });
  }, [currentDeviceId, emergencyLatched, safeCommand.execute, snapshot.calibration.targetAngles]);

  if (!snapshot.authSession.authenticated || snapshot.authSession.mustChangePassword) {
    return (
      <LoginPage
        theme={snapshot.theme}
        error={authError}
        busy={authBusy}
        mustChangePassword={snapshot.authSession.authenticated && snapshot.authSession.mustChangePassword}
        onLogin={loginUser}
        onChangePassword={changeOwnPasswordAfterLogin}
      />
    );
  }

  const canRecoverControl = snapshot.authSession.permissions.includes("connectDevice");

  return (
    <div className={`theme-${snapshot.theme}`}>
      <AppShell
        currentDeviceLabel={currentDeviceId || "未选择设备"}
        connectionLabel={snapshot.connection.state}
        currentUserLabel={snapshot.authSession.username}
        enabled={snapshot.connection.state === "enabled"}
        recording={recorderStatus.active}
        emergencyLatched={emergencyLatched}
        footerItems={[
          `采样 ${snapshot.dashboard.sampleRateHz} Hz`,
          `帧率 ${snapshot.dashboard.frameRateHz} fps`,
          `命令队列 ${snapshot.runtimeDiagnostics.pendingCommands}`,
        ]}
        onEmergencyStop={() => void submitSystemControl("emergencyStop")}
        onLogout={() => void logoutUser()}
      >
        {emergencyLatched ? (
          <div className="emergency-fault-banner" role="alert">
            <div className="emergency-fault-copy">
              <AlertTriangle size={18} />
              <strong>急停已锁定</strong>
              <span>
                {latchedDeviceIds.length > 0
                  ? `锁定设备：${latchedDeviceIds.join("、")}`
                  : "全部运动控制已禁用，正在确认锁定设备。"}
              </span>
            </div>
            {canRecoverControl && latchedDeviceIds.length > 0 ? (
              <div className="emergency-recovery-actions">
                {latchedDeviceIds.map((deviceId) => (
                  <button
                    key={deviceId}
                    type="button"
                    className="emergency-recover-button"
                    onClick={() => void recoverDevice(deviceId)}
                  >
                    <CheckCircle2 size={16} />
                    <span>恢复控制</span>
                    <span className="emergency-recover-device">{deviceId}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {playbackStatus?.active ? (
          <PlaybackBar
            status={playbackStatus}
            onPlayPause={playbackPlayPause}
            onStop={playbackStop}
            onSeek={playbackSeek}
            onStepForward={() => {}}
            onStepBackward={() => {}}
            onSetSpeed={playbackSetSpeed}
          />
        ) : null}
        <AppRouter
          dashboard={<DashboardPage snapshot={snapshot} />}
          workspace={
            <WorkspacePage
              snapshot={snapshot}
              serialPorts={serialPorts}
              serialPortsError={serialPortsError}
              connectedDevices={connectedDevices}
              deviceStatuses={deviceStatuses}
              motionLocked={emergencyLatched}
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
        <ConnectDialog
          open={connectDialogOpen}
          ports={serialPorts}
          profiles={connectionProfiles}
          onConnect={handleConnectDevice}
          onSaveProfile={handleSaveProfile}
          onDeleteProfile={handleDeleteProfile}
          onRefreshPorts={refreshSerialPorts}
          onClose={() => setConnectDialogOpen(false)}
        />
        <ConfirmDialog
          open={safeCommand.confirmation !== null}
          title={safeCommand.confirmation?.title ?? ""}
          details={safeCommand.confirmation?.details ?? []}
          confirmLabel={safeCommand.confirmation?.confirmLabel ?? ""}
          level={safeCommand.confirmation?.level ?? "warning"}
          onConfirm={() => void safeCommand.confirm()}
          onCancel={safeCommand.cancel}
        />
      </AppShell>
    </div>
  );
}

function DashboardPage({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const latestFrame = snapshot.live.frames[0];
  return (
    <div className="page-grid dashboard-grid">
      <Panel title="设备工作台" subtitle="dashboard" icon={Database} wide>
        <div className="data-table">
          <div className="data-row head">
            <span>设备</span>
            <span>状态</span>
            <span>帧号</span>
            <span>延迟</span>
          </div>
          <div className="data-row">
            <span>{latestFrame.deviceId}</span>
            <span><Badge tone={latestFrame.systemEnabled ? "ok" : "warn"}>{latestFrame.systemEnabled ? "已使能" : "空闲"}</Badge></span>
            <span>#{latestFrame.sequence}</span>
            <span>{latestFrame.quality.latencyMs} ms</span>
          </div>
        </div>

        <div className="mini-grid">
          {latestFrame.motors.map((motor) => (
            <article className="mini-card" key={motor.id}>
              <div className="mini-title">电机 {motor.id}</div>
              <div className="mini-value">{motor.positionMm.toFixed(1)} mm</div>
              <div className="mini-sub">{motor.velocityMmPerSec.toFixed(1)} mm/s</div>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="会话概览" subtitle="dashboard" icon={ListChecks}>
        <div className="stack-list">
          <div className="stack-item">
            <span>会话</span>
            <strong>{snapshot.dashboard.currentSession}</strong>
          </div>
          <div className="stack-item">
            <span>配置</span>
            <strong>{snapshot.connection.activeProfileName}</strong>
          </div>
          <div className="stack-item">
            <span>模型</span>
            <strong>{snapshot.model.name}</strong>
          </div>
        </div>
      </Panel>

      <Panel title="最近事件" subtitle="dashboard" icon={Logs}>
        <div className="log-list compact">
          {snapshot.logs.slice(0, 4).map((entry) => (
            <div className="log-row" key={entry.id}>
              <Badge tone={toneForLevel(entry.level)}>{entry.level.toUpperCase()}</Badge>
              <span className="log-scope">{entry.scope}</span>
              <span className="log-message">{entry.message}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="连接健康" subtitle="dashboard" icon={Wifi} wide>
        <div className="health-strip">
          <div>
            <div className="section-label">连接状态</div>
            <div className="health-value">{snapshot.connection.state}</div>
          </div>
          <div>
            <div className="section-label">握手进度</div>
            <div className="health-value">{snapshot.connection.handshakeProgress}%</div>
          </div>
          <div>
            <div className="section-label">帧质量</div>
            <div className="health-value">{latestFrame.quality.status}</div>
          </div>
          <div>
            <div className="section-label">Live buffer</div>
            <div className="health-value">{snapshot.runtimeDiagnostics.storedFrames}/{snapshot.runtimeDiagnostics.liveCapacity}</div>
          </div>
          <div>
            <div className="section-label">Pending queue</div>
            <div className="health-value">{snapshot.runtimeDiagnostics.pendingCommands}</div>
          </div>
          <div>
            <div className="section-label">Protocol errors</div>
            <div className="health-value">{snapshot.runtimeDiagnostics.invalidFrames}</div>
            <span>
              CRC {snapshot.runtimeDiagnostics.checksumErrors} / Decode {snapshot.runtimeDiagnostics.decodeErrors}
            </span>
          </div>
          <div>
            <div className="section-label">E-stop latch</div>
            <div className="health-value">{snapshot.runtimeDiagnostics.emergencyLatched ? "yes" : "no"}</div>
          </div>
          <div>
            <div className="section-label">Control</div>
            <div className="health-value">{snapshot.controlRuntime.active ? snapshot.controlRuntime.phase : "inactive"}</div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function LogsPage({ snapshot }: { snapshot: RuntimeSnapshot }) {
  return (
    <Panel title="日志" subtitle="诊断" icon={Logs} wide>
      <div className="log-list">
        {snapshot.logs.map((entry) => (
          <div className="log-row" key={entry.id}>
            <Badge tone={toneForLevel(entry.level)}>{entry.level.toUpperCase()}</Badge>
            <span className="log-time">{isoShort(entry.timestampMs)}</span>
            <span className="log-scope">{entry.scope}</span>
            <span className="log-message">{entry.message}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

void LogsPage;

function LogsPageV2({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const errorCount = snapshot.logs.filter((entry) => entry.level === "error").length;
  return (
    <div className="logs-page-layout">
      <div className="panel-head">
        <div>
          <div className="panel-kicker">diagnostics</div>
          <h2>日志</h2>
        </div>
        <div className="kv-grid logs-summary">
          <div className="kv-item"><span>总数</span><strong>{snapshot.logs.length}</strong></div>
          <div className="kv-item"><span>错误</span><strong>{errorCount}</strong></div>
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

void LogsPageV2;

function LogsPageV3({ snapshot }: { snapshot: RuntimeSnapshot }) {
  const logFilters: Array<{ level: LogLevel; label: string }> = [
    { level: "warn", label: "warning" },
    { level: "error", label: "error" },
    { level: "info", label: "info" },
    { level: "debug", label: "bug" },
  ];
  const [activeLogFilter, setActiveLogFilter] = useState<LogLevel | "all">("all");
  const visibleLogs = activeLogFilter === "all"
    ? snapshot.logs
    : snapshot.logs.filter((entry) => entry.level === activeLogFilter);
  const errorCount = snapshot.logs.filter((entry) => entry.level === "error").length;

  return (
    <div className="logs-page-layout">
      <div className="panel-head">
        <div>
          <div className="panel-kicker">diagnostics</div>
          <h2>日志</h2>
        </div>
        <div className="kv-grid logs-summary">
          <div className="kv-item"><span>总数</span><strong>{snapshot.logs.length}</strong></div>
          <div className="kv-item"><span>错误</span><strong>{errorCount}</strong></div>
        </div>
      </div>

      <div className="log-filter-bar" aria-label="日志级别筛选">
        <button
          type="button"
          className={`log-filter-chip ${activeLogFilter === "all" ? "active" : ""}`}
          onClick={() => setActiveLogFilter("all")}
        >
          全部
        </button>
        {logFilters.map((filter) => (
          <button
            type="button"
            key={filter.level}
            className={`log-filter-chip ${activeLogFilter === filter.level ? "active" : ""}`}
            onClick={() => setActiveLogFilter(filter.level)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {visibleLogs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-inner">
            <Logs size={28} />
            <div className="empty-state-title">暂无匹配日志</div>
            <p className="empty-state-copy">切换 warning、error、info 或 bug 筛选查看对应级别的运行记录。</p>
          </div>
        </div>
      ) : (
        <div className="log-list layout-scroll">
          {visibleLogs.map((entry) => (
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

function SettingsPage({
  snapshot,
  users,
  diagnosticsPath,
  migrationSource,
  migrationPreview,
  migrationReport,
  onToggleTheme,
  onExportDiagnostics,
  onMigrationSourceChange,
  onPreviewMigration,
  onRunMigration,
  onCreateUser,
  onResetUserPassword,
  onSetUserDisabled,
}: {
  snapshot: RuntimeSnapshot;
  users: UserAccount[];
  diagnosticsPath: string;
  migrationSource: string;
  migrationPreview: LegacyMigrationPreview | null;
  migrationReport: LegacyMigrationReport | null;
  onToggleTheme: () => void;
  onExportDiagnostics: () => void;
  onMigrationSourceChange: (value: string) => void;
  onPreviewMigration: () => void;
  onRunMigration: () => void;
  onCreateUser: (username: string, password: string, role: Role) => Promise<void>;
  onResetUserPassword: (username: string, newPassword: string) => Promise<void>;
  onSetUserDisabled: (username: string, disabled: boolean) => Promise<void>;
}) {
  const migrationTotal = migrationPreview
    ? migrationPreview.userFiles + migrationPreview.configFiles + migrationPreview.csvFiles + migrationPreview.logFiles
    : 0;
  const canManageUsers = snapshot.authSession.permissions.includes("manageUsers");
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("operator");
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

  const runAccountAction = async (action: () => Promise<void>, successMessage: string) => {
    setAccountMessage("");
    try {
      await action();
      setAccountMessage(successMessage);
    } catch (invokeError) {
      setAccountMessage(invokeError instanceof Error ? invokeError.message : String(invokeError));
    }
  };

  const submitCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    await runAccountAction(async () => {
      await onCreateUser(newUsername, newUserPassword, newUserRole);
      setNewUsername("");
      setNewUserPassword("");
      setNewUserRole("operator");
    }, "用户已创建");
  };

  const submitResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    await runAccountAction(async () => {
      await onResetUserPassword(resetUsername, resetPassword);
      setResetPassword("");
    }, "密码已重置");
  };

  return (
    <div className="page-grid settings-grid">
      <Panel title="应用配置" subtitle="settings" icon={Settings2} wide>
        <div className="settings-stack">
          <div className="stack-item">
            <span>主题</span>
            <strong>{snapshot.settings.theme}</strong>
          </div>
          <div className="stack-item">
            <span>界面密度</span>
            <strong>{snapshot.settings.workspaceDensity}</strong>
          </div>
          <div className="stack-item">
            <span>数据目录</span>
            <strong>{snapshot.settings.dataDirectory}</strong>
          </div>
          <div className="stack-item">
            <span>模型目录</span>
            <strong>{snapshot.settings.modelDirectory}</strong>
          </div>
          <div className="stack-item">
            <span>自动重连</span>
            <strong>{snapshot.settings.autoReconnect ? "启用" : "关闭"}</strong>
          </div>
          <div className="stack-item">
            <span>诊断级别</span>
            <strong>{snapshot.settings.diagnosticsLevel}</strong>
          </div>
        </div>
      </Panel>

      <Panel title="账户与权限" subtitle="auth" icon={Fingerprint}>
        <div className="settings-stack">
          <div className="stack-item">
            <span>当前用户</span>
            <strong>{snapshot.authSession.authenticated ? snapshot.authSession.username : "未登录"}</strong>
          </div>
          <div className="stack-item">
            <span>角色</span>
            <strong>{snapshot.authSession.role}</strong>
          </div>
          <div className="stack-item">
            <span>用户数量</span>
            <strong>{users.length || "无权限查看"}</strong>
          </div>
          {canManageUsers ? (
            <>
              <div className="settings-user-list">
                {users.map((user) => (
                  <div className="settings-user-row" key={user.username}>
                    <div className="settings-user-main">
                      <strong>{user.username}</strong>
                      <span>{user.role}{user.mustChangePassword ? " / 需改密" : ""}</span>
                    </div>
                    <Badge tone={user.disabled ? "error" : "ok"}>{user.disabled ? "停用" : "启用"}</Badge>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => void runAccountAction(
                        () => onSetUserDisabled(user.username, !user.disabled),
                        user.disabled ? "用户已启用" : "用户已停用",
                      )}
                      disabled={user.username === snapshot.authSession.username}
                    >
                      <span>{user.disabled ? "启用" : "停用"}</span>
                    </button>
                  </div>
                ))}
              </div>

              <form className="account-form" onSubmit={submitCreateUser}>
                <label>
                  <span>新用户</span>
                  <input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="operator_1" />
                </label>
                <label>
                  <span>初始密码</span>
                  <input type="password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} />
                </label>
                <label>
                  <span>角色</span>
                  <select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as Role)}>
                    <option value="operator">operator</option>
                    <option value="maintainer">maintainer</option>
                    <option value="admin">admin</option>
                  </select>
                </label>
                <button type="submit" className="primary-btn full" disabled={!newUsername.trim() || newUserPassword.length < 8}>
                  <CheckCircle2 size={16} />
                  <span>创建用户</span>
                </button>
              </form>

              <form className="account-form" onSubmit={submitResetPassword}>
                <label>
                  <span>重置用户</span>
                  <select value={resetUsername} onChange={(event) => setResetUsername(event.target.value)}>
                    <option value="">选择用户</option>
                    {users.map((user) => (
                      <option value={user.username} key={user.username}>{user.username}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>新密码</span>
                  <input type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
                </label>
                <button type="submit" className="ghost-btn full" disabled={!resetUsername || resetPassword.length < 8}>
                  <Save size={16} />
                  <span>重置密码</span>
                </button>
              </form>
            </>
          ) : (
            <div className="settings-result">当前角色没有用户管理权限。</div>
          )}
          {accountMessage ? <div className="settings-result">{accountMessage}</div> : null}
        </div>
      </Panel>

      <Panel title="诊断导出" subtitle="diagnostics" icon={PauseCircle}>
        <div className="button-stack">
          <button type="button" className="ghost-btn full" onClick={onToggleTheme}>
            <SunMedium size={16} />
            <span>切换主题</span>
          </button>
          <button type="button" className="ghost-btn full" onClick={onExportDiagnostics}>
            <Cpu size={16} />
            <span>导出诊断包</span>
          </button>
        </div>
        {diagnosticsPath ? <div className="settings-result">{diagnosticsPath}</div> : null}
      </Panel>

      <Panel title="旧版迁移" subtitle="migration" icon={Database} wide>
        <div className="migration-form">
          <label>
            <span>旧版目录</span>
            <input
              type="text"
              value={migrationSource}
              onChange={(event) => onMigrationSourceChange(event.target.value)}
              placeholder="例如 D:\\...\\SoftUI"
            />
          </label>
          <button type="button" className="ghost-btn" onClick={onPreviewMigration}>
            <Eye size={16} />
            <span>预览</span>
          </button>
          <button type="button" className="primary-btn" onClick={onRunMigration} disabled={!migrationPreview?.exists}>
            <Database size={16} />
            <span>执行迁移</span>
          </button>
        </div>

        {migrationPreview ? (
          <div className="migration-summary">
            <div><span>用户</span><strong>{migrationPreview.userFiles}</strong></div>
            <div><span>配置</span><strong>{migrationPreview.configFiles}</strong></div>
            <div><span>CSV</span><strong>{migrationPreview.csvFiles}</strong></div>
            <div><span>日志</span><strong>{migrationPreview.logFiles}</strong></div>
            <div><span>可迁移</span><strong>{migrationTotal}</strong></div>
            <div><span>跳过</span><strong>{migrationPreview.skippedFiles}</strong></div>
          </div>
        ) : null}

        {migrationPreview?.warnings.length ? (
          <div className="settings-warning">
            {migrationPreview.warnings.slice(0, 3).map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </div>
        ) : null}

        {migrationReport ? <div className="settings-result">报告：{migrationReport.reportPath}</div> : null}
      </Panel>
    </div>
  );
}

type SettingsPageV2Props = Parameters<typeof SettingsPage>[0];

function SettingsPageV2({
  snapshot,
  users,
  diagnosticsPath,
  migrationSource,
  migrationPreview,
  migrationReport,
  onToggleTheme,
  onExportDiagnostics,
  onMigrationSourceChange,
  onPreviewMigration,
  onRunMigration,
  onCreateUser,
  onResetUserPassword,
  onSetUserDisabled,
}: SettingsPageV2Props) {
  const migrationTotal = migrationPreview
    ? migrationPreview.userFiles + migrationPreview.configFiles + migrationPreview.csvFiles + migrationPreview.logFiles
    : 0;
  const canManageUsers = snapshot.authSession.permissions.includes("manageUsers");
  const [newUsername, setNewUsername] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<Role>("operator");
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [accountMessage, setAccountMessage] = useState("");

  const runAccountAction = async (action: () => Promise<void>, successMessage: string) => {
    setAccountMessage("");
    try {
      await action();
      setAccountMessage(successMessage);
    } catch (invokeError) {
      setAccountMessage(invokeError instanceof Error ? invokeError.message : String(invokeError));
    }
  };

  const submitCreateUser = async (event: FormEvent) => {
    event.preventDefault();
    await runAccountAction(async () => {
      await onCreateUser(newUsername, newUserPassword, newUserRole);
      setNewUsername("");
      setNewUserPassword("");
      setNewUserRole("operator");
    }, "用户已创建");
  };

  const submitResetPassword = async (event: FormEvent) => {
    event.preventDefault();
    await runAccountAction(async () => {
      await onResetUserPassword(resetUsername, resetPassword);
      setResetPassword("");
    }, "密码已重置");
  };

  return (
    <div className="page-grid settings-grid">
      <Panel title="应用配置" subtitle="settings" icon={Settings2} wide>
        <div className="settings-config-grid kv-grid">
          <div className="kv-item"><span>主题</span><strong>{snapshot.settings.theme}</strong></div>
          <div className="kv-item"><span>界面密度</span><strong>{snapshot.settings.workspaceDensity}</strong></div>
          <div className="kv-item"><span>自动重连</span><strong>{snapshot.settings.autoReconnect ? "启用" : "关闭"}</strong></div>
          <div className="kv-item"><span>诊断级别</span><strong>{snapshot.settings.diagnosticsLevel}</strong></div>
          <div className="kv-item path-item">
            <span>数据目录</span>
            <strong className="path-value" title={snapshot.settings.dataDirectory}>{snapshot.settings.dataDirectory}</strong>
          </div>
          <div className="kv-item path-item">
            <span>模型目录</span>
            <strong className="path-value" title={snapshot.settings.modelDirectory}>{snapshot.settings.modelDirectory}</strong>
          </div>
        </div>
      </Panel>

      <Panel title="账户与权限" subtitle="auth" icon={Fingerprint}>
        <div className="settings-stack">
          <div className="kv-grid account-summary-grid">
            <div className="kv-item">
              <span>当前用户</span>
              <strong>{snapshot.authSession.authenticated ? snapshot.authSession.username : "未登录"}</strong>
            </div>
            <div className="kv-item"><span>角色</span><strong>{snapshot.authSession.role}</strong></div>
            <div className="kv-item"><span>用户数量</span><strong>{users.length || "无权限查看"}</strong></div>
          </div>

          {canManageUsers ? (
            <>
              <div className="settings-user-list layout-scroll">
                {users.map((user) => (
                  <div className="settings-user-row" key={user.username}>
                    <div className="settings-user-main">
                      <strong className="text-truncate" title={user.username}>{user.username}</strong>
                      <span>{user.role}{user.mustChangePassword ? " / 需改密" : ""}</span>
                    </div>
                    <Badge tone={user.disabled ? "error" : "ok"}>{user.disabled ? "停用" : "启用"}</Badge>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => void runAccountAction(
                        () => onSetUserDisabled(user.username, !user.disabled),
                        user.disabled ? "用户已启用" : "用户已停用",
                      )}
                      disabled={user.username === snapshot.authSession.username}
                    >
                      <span>{user.disabled ? "启用" : "停用"}</span>
                    </button>
                  </div>
                ))}
              </div>

              <form className="account-form" onSubmit={submitCreateUser}>
                <label>
                  <span>新用户</span>
                  <input value={newUsername} onChange={(event) => setNewUsername(event.target.value)} placeholder="operator_1" />
                </label>
                <label>
                  <span>初始密码</span>
                  <input type="password" value={newUserPassword} onChange={(event) => setNewUserPassword(event.target.value)} />
                </label>
                <label>
                  <span>角色</span>
                  <select value={newUserRole} onChange={(event) => setNewUserRole(event.target.value as Role)}>
                    <option value="operator">operator</option>
                    <option value="maintainer">maintainer</option>
                    <option value="admin">admin</option>
                  </select>
                </label>
                <button type="submit" className="primary-btn full" disabled={!newUsername.trim() || newUserPassword.length < 8}>
                  <CheckCircle2 size={16} />
                  <span>创建用户</span>
                </button>
              </form>

              <form className="account-form" onSubmit={submitResetPassword}>
                <label>
                  <span>重置用户</span>
                  <select value={resetUsername} onChange={(event) => setResetUsername(event.target.value)}>
                    <option value="">选择用户</option>
                    {users.map((user) => (
                      <option value={user.username} key={user.username}>{user.username}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>新密码</span>
                  <input type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} />
                </label>
                <button type="submit" className="ghost-btn full" disabled={!resetUsername || resetPassword.length < 8}>
                  <Save size={16} />
                  <span>重置密码</span>
                </button>
              </form>
            </>
          ) : (
            <div className="settings-result">当前角色没有用户管理权限。</div>
          )}
          {accountMessage ? <div className="settings-result">{accountMessage}</div> : null}
        </div>
      </Panel>

      <Panel title="诊断导出" subtitle="diagnostics" icon={PauseCircle}>
        <div className="button-stack">
          <button type="button" className="ghost-btn full" onClick={onToggleTheme}>
            <SunMedium size={16} />
            <span>切换主题</span>
          </button>
          <button type="button" className="ghost-btn full" onClick={onExportDiagnostics}>
            <Cpu size={16} />
            <span>导出诊断包</span>
          </button>
        </div>
        {diagnosticsPath ? <div className="settings-result path-value" title={diagnosticsPath}>{diagnosticsPath}</div> : null}
      </Panel>

      <Panel title="旧版迁移" subtitle="migration" icon={Database} wide>
        <div className="migration-form">
          <label>
            <span>旧版目录</span>
            <input
              type="text"
              value={migrationSource}
              onChange={(event) => onMigrationSourceChange(event.target.value)}
              placeholder="例如 D:\\...\\SoftUI"
            />
          </label>
          <button type="button" className="ghost-btn" onClick={onPreviewMigration}>
            <Eye size={16} />
            <span>预览</span>
          </button>
          <button type="button" className="primary-btn" onClick={onRunMigration} disabled={!migrationPreview?.exists}>
            <Database size={16} />
            <span>执行迁移</span>
          </button>
        </div>

        {migrationPreview ? (
          <div className="migration-summary">
            <div><span>用户</span><strong>{migrationPreview.userFiles}</strong></div>
            <div><span>配置</span><strong>{migrationPreview.configFiles}</strong></div>
            <div><span>CSV</span><strong>{migrationPreview.csvFiles}</strong></div>
            <div><span>日志</span><strong>{migrationPreview.logFiles}</strong></div>
            <div><span>可迁移</span><strong>{migrationTotal}</strong></div>
            <div><span>跳过</span><strong>{migrationPreview.skippedFiles}</strong></div>
          </div>
        ) : null}

        {migrationPreview?.warnings.length ? (
          <div className="settings-warning">
            {migrationPreview.warnings.slice(0, 3).map((warning) => (
              <span key={warning}>{warning}</span>
            ))}
          </div>
        ) : null}

        {migrationReport ? <div className="settings-result path-value" title={migrationReport.reportPath}>报告：{migrationReport.reportPath}</div> : null}
      </Panel>
    </div>
  );
}

function App() {
  return (
    <HashRouter>
      <AppController />
    </HashRouter>
  );
}

export default App;

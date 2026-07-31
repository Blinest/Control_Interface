import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Database,
  Eye,
  Fingerprint,
  Logs,
  PauseCircle,
  Save,
  Settings2,
  SunMedium,
} from "lucide-react";
import { HashRouter } from "react-router-dom";

import { AppRouter } from "./app/AppRouter";
import { AppShell } from "./app/AppShell";
import ConnectDialog from "./components/ConnectDialog";
import PlaybackBar from "./components/PlaybackBar";
import { ConfirmDialog } from "./components/feedback/ConfirmDialog";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import ChartsPage from "./features/charts/ChartsPage";
import {
  createConfirmationSafetyContext,
  getLatchedDeviceIds,
  resolveRecoveryDeviceId,
  shouldInvalidateConfirmation,
} from "./features/device-workspace/deviceSafety";
import {
  DeviceWorkspacePage,
  type MotorCommandRequest,
  type SystemControlAction,
  type WorkspaceCommand,
  type WorkspaceCommandPayload,
} from "./features/device-workspace/DeviceWorkspacePage";
import { isPlaybackForDevice } from "./features/device-workspace/devicePlayback";
import { useSafeCommand } from "./features/device-workspace/useSafeCommand";
import type { CommandKind } from "./services/commandPolicy";
import { tauriClient } from "./services/tauriClient";
import { reconcileDeviceRefresh, selectCurrentDevice } from "./state/deviceSelectionStore";
import { makeFallbackSnapshot } from "./state/fallbackSnapshot";
import { applyTheme, readThemePreference, resolveTheme, writeThemePreference } from "./state/themeStore";
import SessionsPage from "./pages/SessionsPage";
import type {
  AuthSession,
  ConnectDeviceRequest,
  ConnectionProfile,
  ControlRuntimeStatus,
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

function AppController() {
  const [snapshot, setSnapshot] = useState<RuntimeSnapshot>(makeFallbackSnapshot);
  const [currentDeviceId, setCurrentDeviceId] = useState(() => localStorage.getItem("softui:currentDeviceId") ?? "");
  const currentDeviceIdRef = useRef(currentDeviceId);
  const connectedDevicesRefreshIdRef = useRef(0);
  const [serialPorts, setSerialPorts] = useState<SerialPortDescriptor[]>([]);
  const [connectedDevices, setConnectedDevices] = useState<DeviceConnectionRecord[]>([]);
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, DeviceRuntimeStatusView>>({});
  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
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
    } catch (invokeError) {
      setSerialPorts([]);
      console.error(invokeError);
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

  const submitSystemControl = useCallback(async (
    action: SystemControlAction,
    requestedDeviceId = currentDeviceId,
  ) => {
    const deviceId = requestedDeviceId;
    if (action !== "emergencyStop" && (!deviceId || deviceId !== currentDeviceId)) return;

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

  const sendMotorCommand = useCallback(async (command: MotorCommandRequest) => {
    if (emergencyLatched || !command.deviceId || command.deviceId !== currentDeviceId) return;

    const request = {
      deviceId: command.deviceId,
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

  const submitWorkspaceCommand = useCallback(async (command: WorkspaceCommand, payload: WorkspaceCommandPayload) => {
    const deviceId = payload.deviceId;
    if (!deviceId || deviceId !== currentDeviceId) return;

    if (command === "loadPlayback") {
      if (payload.sessionId) await loadPlayback(payload.sessionId);
      return;
    }
    if (command === "playbackToggle") {
      await playbackPlayPause();
      return;
    }
    if (command === "playbackStop") {
      await playbackStop();
      return;
    }
    if (command === "playbackSeek") {
      await playbackSeek(payload.ms ?? 0);
      return;
    }
    if (command === "playbackSpeed") {
      await playbackSetSpeed(payload.speed ?? 1);
      return;
    }

    if (command === "updatePid" || command === "configureCycle") {
      try {
        const controlRuntime = command === "updatePid"
          ? await tauriClient.invoke<ControlRuntimeStatus>("update_pid_control", {
              config: payload.pid ?? snapshot.controlRuntime.pid,
              deviceId,
            })
          : await tauriClient.invoke<ControlRuntimeStatus>("configure_cycle_life", {
              config: payload.cycle ?? snapshot.controlRuntime.cycle,
              deviceId,
            });
        setSnapshot((previous) => ({ ...previous, controlRuntime }));
      } catch (invokeError) {
        console.error(invokeError);
      }
      return;
    }

    if (command === "stopCycle") {
      try {
        const next = await tauriClient.invoke<RuntimeSnapshot>("stop_cycle_life", {
          deviceId,
          reason: payload.reason ?? "operator stopped cycle life",
        });
        setSnapshot({
          ...next,
          live: { ...next.live, selectedDeviceId: currentDeviceIdRef.current },
        });
      } catch (invokeError) {
        console.error(invokeError);
      }
      return;
    }

    const targetAngles = snapshot.calibration.targetAngles;
    const commandMap: Partial<Record<WorkspaceCommand, { kind: CommandKind; name: string; request: Record<string, unknown> }>> = {
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
      startCycle: {
        kind: "cycleControl",
        name: "start_cycle_life",
        request: { deviceId, config: payload.cycle ?? snapshot.controlRuntime.cycle },
      },
    };
    const selected = commandMap[command];
    if (!selected) return;
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
  }, [
    currentDeviceId,
    emergencyLatched,
    loadPlayback,
    playbackPlayPause,
    playbackSeek,
    playbackSetSpeed,
    playbackStop,
    safeCommand.execute,
    snapshot.calibration.targetAngles,
    snapshot.controlRuntime.cycle,
    snapshot.controlRuntime.pid,
  ]);

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
  const currentDevicePlaybackActive = isPlaybackForDevice(
    playbackStatus,
    sessions,
    currentDeviceId,
  );

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
        {currentDevicePlaybackActive && playbackStatus ? (
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
          dashboard={
            <DashboardPage
              snapshot={snapshot}
              connectedDevices={connectedDevices}
              deviceStatuses={deviceStatuses}
              recorderStatus={recorderStatus}
              sessions={sessions}
            />
          }
          deviceWorkspace={
            <DeviceWorkspacePage
              snapshot={snapshot}
              currentDeviceId={currentDeviceId}
              connectedDevices={connectedDevices}
              deviceStatuses={deviceStatuses}
              recorderStatus={recorderStatus}
              sessions={sessions}
              playbackStatus={playbackStatus}
              onSelectDevice={setCurrentDevice}
              onOpenConnectDialog={toggleConnection}
              onDisconnectDevice={handleDisconnectDevice}
              onRefreshSerialPorts={refreshSerialPorts}
              onSystemControl={submitSystemControl}
              onSendMotor={sendMotorCommand}
              onWorkspaceCommand={submitWorkspaceCommand}
            />
          }
          charts={<ChartsPage snapshot={snapshot} currentDeviceId={currentDeviceId} />}
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

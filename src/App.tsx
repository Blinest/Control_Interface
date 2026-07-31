import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Fingerprint,
} from "lucide-react";
import { HashRouter } from "react-router-dom";

import { AppRouter } from "./app/AppRouter";
import { AppShell } from "./app/AppShell";
import ConnectDialog from "./components/ConnectDialog";
import PlaybackBar from "./components/PlaybackBar";
import { ConfirmDialog } from "./components/feedback/ConfirmDialog";
import { DashboardPage } from "./features/dashboard/DashboardPage";
import ChartsPage from "./features/charts/ChartsPage";
import LogsPage from "./features/logs/LogsPage";
import SettingsPage from "./features/settings/SettingsPage";
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
import { resetLayout } from "./state/layoutStore";
import {
  applyTheme,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
  type ThemePreference,
} from "./state/themeStore";
import type {
  AuthSession,
  ConnectDeviceRequest,
  ConnectionProfile,
  ControlRuntimeStatus,
  DeviceConnectionRecord,
  DeviceRuntimeStatusView,
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
import SessionsPage from "./features/sessions/SessionsPage";

function resolveThemeForUser(username: string): ThemeMode {
  return resolveTheme(
    readThemePreference(username),
    window.matchMedia("(prefers-color-scheme: dark)").matches,
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

  const setThemePreference = useCallback(async (preference: ThemePreference) => {
    const resolved = resolveTheme(
      preference,
      window.matchMedia("(prefers-color-scheme: dark)").matches,
    );
    writeThemePreference(snapshot.authSession.username, preference);
    applyTheme(resolved);
    try {
      const next = await tauriClient.invoke<RuntimeSnapshot>("set_theme", { theme: resolved });
      setSnapshot((prev) => ({
        ...next,
        live: { ...next.live, selectedDeviceId: currentDeviceIdRef.current },
        theme: resolved,
        settings: { ...next.settings, theme: resolved },
        authSession: next.authSession.authenticated ? next.authSession : prev.authSession,
      }));
    } catch {
      setSnapshot((prev) => ({
        ...prev,
        theme: resolved,
        settings: { ...prev.settings, theme: resolved },
      }));
    }
  }, [snapshot.authSession.username]);

  const resetLayouts = useCallback(() => {
    resetLayout(snapshot.authSession.username, "dashboard");
    resetLayout(snapshot.authSession.username, "workspace-monitor");
  }, [snapshot.authSession.username]);

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
              snapshot={snapshot}
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
          logs={<LogsPage logs={snapshot.logs} onExportDiagnostics={exportDiagnostics} />}
          settings={
            <SettingsPage
              snapshot={snapshot}
              users={users}
              diagnosticsPath={diagnosticsPath}
              migrationSource={migrationSource}
              migrationPreview={migrationPreview}
              migrationReport={migrationReport}
              onThemePreferenceChange={setThemePreference}
              onExportDiagnostics={exportDiagnostics}
              onMigrationSourceChange={setMigrationSource}
              onPreviewMigration={previewMigration}
              onRunMigration={runMigration}
              onCreateUser={createUserAccount}
              onResetUserPassword={resetUserPassword}
              onSetUserDisabled={setUserDisabled}
              onResetLayouts={resetLayouts}
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

function App() {
  return (
    <HashRouter>
      <AppController />
    </HashRouter>
  );
}

export default App;

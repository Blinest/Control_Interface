import type {
  DeviceSnapshot,
  LogEntry,
  MotorState,
  RuntimeSnapshot,
  SensorState,
  ThemeMode,
} from "../softuiTypes";
function makeDefaultLogs(): LogEntry[] {
  const now = Date.now();
  return [
    { id: 1, level: "info", scope: "boot", message: "SoftUI 运行时就绪", timestampMs: now },
    {
      id: 2,
      level: "info",
      scope: "connection",
      message: "模拟器握手完成",
      timestampMs: now - 8_000,
      deviceId: "softui-sim-01",
    },
    {
      id: 3,
      level: "warn",
      scope: "device",
      message: "使用模拟传输，等待选择串口",
      timestampMs: now - 16_000,
      deviceId: "softui-sim-01",
      frameHex: "BB 02 10 01 00 00 00 00 00 23",
    },
    {
      id: 4,
      level: "debug",
      scope: "stream",
      message: "实时快照已刷新",
      timestampMs: now - 24_000,
      deviceId: "softui-sim-01",
      frameHex: "BB 02 10 01 00 00 01 00 00 24",
    },
    {
      id: 5,
      level: "error",
      scope: "audit",
      message: "诊断包尚未导出",
      timestampMs: now - 32_000,
    },
  ];
}

function makeFallbackMotor(id: number, seed: number): MotorState {
  return {
    id,
    positionMm: 23.4 + seed * 0.8 + id * 0.9,
    velocityMmPerSec: 7.2 + seed * 0.35 + (id % 3) * 0.25,
    accelerationMmPerSec2: 2.0 + (id % 4) * 0.18,
    running: true,
    targetPositionMm: 25.0 + seed * 0.8 + id * 0.9,
  };
}

function makeFallbackSensor(id: number, seed: number): SensorState {
  return {
    id,
    raw: [31.5 + id * 0.4 + seed * 0.2, 17.2 + id * 0.25 + seed * 0.15, 11.1 + id * 0.18 + seed * 0.1],
    filtered: [30.9 + id * 0.35 + seed * 0.16, 16.8 + id * 0.2 + seed * 0.1, 10.7 + id * 0.14 + seed * 0.08],
    alias: ["X", "Y", "Z"],
    unit: "N",
    quality: "ok",
  };
}

function makeFallbackFrame(sequence: number, receivedAtMs: number, bend1: number, bend2: number): DeviceSnapshot {
  return {
    deviceId: "softui-sim-01",
    connectionId: "conn-01",
    receivedAtMs,
    sequence,
    protocolVersion: "Legacy V1",
    systemEnabled: true,
    motors: Array.from({ length: 6 }, (_, index) => makeFallbackMotor(index + 1, sequence / 120 + index * 0.3)),
    sensors: Array.from({ length: 6 }, (_, index) => makeFallbackSensor(index + 1, sequence / 150 + index * 0.18)),
    bend: {
      section1: { angleDeg: bend1, targetAngleDeg: bend1 + 4, direction: "up", quality: "ok" },
      section2: { angleDeg: bend2, targetAngleDeg: bend2 + 5, direction: "right", quality: "ok" },
    },
    quality: { status: "ok", latencyMs: sequence % 2 === 0 ? 18 : 19, droppedFrames: 0, checksumOk: true },
  };
}

function getCachedTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark";
  return localStorage.getItem("softui:theme") === "light" ? "light" : "dark";
}

export function makeFallbackSnapshot(): RuntimeSnapshot {
  const now = Date.now();
  const theme = getCachedTheme();
  const frames: DeviceSnapshot[] = [
    makeFallbackFrame(1201, now, 31, 22),
    makeFallbackFrame(1200, now - 80, 30, 21),
  ];

  return {
    appInfo: {
      name: "SoftUI",
      version: "0.1.0",
      backend: "Rust + Tauri 2",
      frontend: "React + TypeScript + Three.js",
      platform: navigator.platform,
    },
    theme,
    connection: {
      state: "ready",
      activeProfileId: "sim-default",
      activeProfileName: "Simulator",
      profiles: [
        { id: "sim-default", name: "Simulator", port: "SIM", baudRate: 115200, dataBits: 8, parity: "none", stopBits: 1, flowControl: "none", autoReconnect: true },
        { id: "serial-legacy", name: "Legacy USB", port: "COM3", baudRate: 9600, dataBits: 8, parity: "none", stopBits: 1, flowControl: "none", autoReconnect: false },
      ],
      ports: ["COM3", "COM4", "ttyUSB0", "ttyACM0"],
      handshakeStep: "frame verification",
      handshakeProgress: 100,
      lastMessage: "Simulator stream active",
    },
    dashboard: {
      deviceCount: 2,
      connectedDevices: 1,
      currentSession: "session-20260714-002",
      sampleRateHz: 100,
      frameRateHz: 30,
      activeProfile: "sim-default",
      lastError: null,
    },
    live: { selectedDeviceId: "softui-sim-01", frames },
    charts: {
      windowSize: 96,
      channels: Array.from({ length: 6 }, (_, index) => ({
        name: `Motor ${index + 1}`,
        unit: "mm",
        channelType: "motor",
        channelIndex: index + 1,
        points: Array.from({ length: 96 }, (_, pointIndex) => {
          const x = pointIndex / (8 + index) + index * 0.35;
          return 0.5 + Math.sin(x) * (0.2 - index * 0.015) + Math.cos(x * 0.8) * (0.12 - index * 0.01);
        }),
      })),
    },
    model: {
      id: "default-continuum",
      name: "Default continuum robot",
      modelPath: "resources/models/default_robot.glb",
      section1MaxAngleDeg: 78,
      section2MaxAngleDeg: 64,
      section1Node: "section_1_root",
      section2Node: "section_2_root",
    },
    calibration: {
      selectedSection: "section1",
      targetAngles: [29, 24],
      captured: false,
      steps: [
        { id: 1, label: "Zero reference", done: true, active: true },
        { id: 2, label: "Upper segment", done: true, active: false },
        { id: 3, label: "Lower segment", done: false, active: false },
        { id: 4, label: "Positive bend", done: false, active: false },
        { id: 5, label: "Save profile", done: false, active: false },
      ],
    },
    playback: {
      activeSessionId: "session-20260714-002",
      speed: 1,
      cursorMs: 18000,
      durationMs: 126000,
      sessions: [
        { id: "session-20260714-001", name: "Bench verification", startTime: "2026-07-14T09:15:00+08:00", endTime: "2026-07-14T09:38:00+08:00", operator: "research", deviceIds: ["softui-sim-01"], recordCount: 18420 },
        { id: "session-20260714-002", name: "Closed-loop test", startTime: "2026-07-14T11:20:00+08:00", endTime: null, operator: "research", deviceIds: ["softui-sim-01"], recordCount: 9480 },
      ],
    },
    playbackMode: false,
    controlProfiles: [
      { id: "cycle-life", name: "Cycle life", enabled: true, cycleLifeEnabled: true, thresholdLow: 12, thresholdHigh: 48, cyclePeriodMs: 1250 },
      { id: "manual-safe", name: "Manual safe mode", enabled: false, cycleLifeEnabled: false, thresholdLow: 8, thresholdHigh: 42, cyclePeriodMs: 1500 },
    ],
    filterProfiles: [
      { id: "median-3", name: "Median 3", enabled: true, windowSize: 3, exponentialAlpha: 0.45 },
      { id: "ema", name: "EMA", enabled: true, windowSize: 5, exponentialAlpha: 0.32 },
    ],
    logs: makeDefaultLogs(),
    settings: {
      theme,
      workspaceDensity: "comfortable",
      saveLayoutOnExit: true,
      autoReconnect: true,
      diagnosticsLevel: "info",
      dataDirectory: "experiment_data",
      modelDirectory: "resources/models",
    },
    runtimeDiagnostics: {
      storedFrames: 0,
      liveCapacity: 6000,
      totalFrames: 0,
      droppedFrames: 0,
      frameRateHz: 0,
      deviceCount: 0,
      pendingCommands: 0,
      sentCommands: 0,
      protocolErrors: 0,
      reconnectAttempts: 0,
      emergencyLatched: false,
      lastError: null,
      validFrames: 0,
      invalidFrames: 0,
      checksumErrors: 0,
      decodeErrors: 0,
      lastProtocolError: null,
    },
    controlRuntime: {
      pid: {
        kp: 0.35,
        ki: 0.04,
        kd: 0.08,
        deadbandDeg: 0.2,
        integralLimit: 30,
        outputLimit: 8,
        samplePeriodMs: 50,
      },
      cycle: {
        enabled: false,
        lowerAngleDeg: 12,
        upperAngleDeg: 48,
        toleranceDeg: 1,
        dwellMs: 250,
        maxCycles: 0,
      },
      phase: "idle",
      active: false,
      allowed: false,
      reason: "cycle life inactive",
      targetAngleDeg: 0,
      pidOutput: 0,
      motorDeltaMm: 0,
      cyclesCompleted: 0,
    },
    authSession: {
      authenticated: false,
      username: "",
      role: "operator",
      permissions: [],
      mustChangePassword: false,
    },
  };
}

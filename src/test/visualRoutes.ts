import { makeFallbackSnapshot } from "../state/fallbackSnapshot";

declare global {
  interface Window {
    __SOFTUI_VISUAL_SMOKE__?: boolean;
  }
}

const visualSmokeUsername = "visual-smoke";

export function isVisualSmokeMode(): boolean {
  return import.meta.env.DEV && typeof window !== "undefined" && window.__SOFTUI_VISUAL_SMOKE__ === true;
}

export function getVisualSmokeResponse(command: string): unknown {
  const snapshot = makeFallbackSnapshot();
  const authenticatedSnapshot = {
    ...snapshot,
    authSession: {
      authenticated: true,
      username: visualSmokeUsername,
      role: "admin" as const,
      permissions: ["connectDevice", "manageUsers", "manageSettings"],
      mustChangePassword: false,
    },
  };

  switch (command) {
    case "bootstrap_state":
    case "tick_snapshot":
      return authenticatedSnapshot;
    case "list_serial_ports":
    case "list_connected_devices":
    case "list_users":
      return [];
    case "list_connection_profiles":
      return snapshot.connection.profiles;
    case "list_sessions":
      return snapshot.playback.sessions;
    case "recorder_status":
      return { active: false, sessionId: "", sessionName: "", frameCount: 0, elapsedSecs: 0, paused: false };
    case "fetch_live_window":
    case "read_session_frames":
      return snapshot.live.frames;
    case "playback_status":
      return { active: false, sessionId: "", playing: false, speed: 1, cursorMs: 0, durationMs: 0, cursorPct: 0, totalFrames: 0, currentFrameIdx: 0 };
    default:
      return null;
  }
}

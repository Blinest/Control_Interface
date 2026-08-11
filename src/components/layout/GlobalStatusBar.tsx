import { LogOut, OctagonX } from "lucide-react";

interface GlobalStatusBarProps {
  currentDeviceLabel: string;
  connectionLabel: string;
  currentUserLabel?: string;
  enabled: boolean;
  recording: boolean;
  emergencyLatched: boolean;
  onEmergencyStop: () => void;
  onLogout?: () => void;
}

type StatusSeverity = "danger" | "muted" | "ok" | "warning";

function statusSeverity(label: string): StatusSeverity {
  const normalized = label.toLowerCase();
  if (label.includes("急停") || label.includes("故障") || normalized.includes("error")) return "danger";
  if (label.includes("等待") || label.includes("录制中") || normalized.includes("warning")) return "warning";
  if (["ready", "enabled", "正常", "已使能"].includes(label)) return "ok";
  return "muted";
}

function statusChipClass(label: string, extraClass = "") {
  return `status-chip status-indicator is-${statusSeverity(label)}${extraClass ? ` ${extraClass}` : ""}`;
}

export function GlobalStatusBar({
  currentDeviceLabel,
  connectionLabel,
  currentUserLabel,
  enabled,
  recording,
  emergencyLatched,
  onEmergencyStop,
  onLogout,
}: GlobalStatusBarProps) {
  const enabledLabel = enabled ? "已使能" : "未使能";
  const recordingLabel = recording ? "录制中" : "未录制";

  return (
    <header className="global-status-bar">
      <div className="global-status-items" aria-label="全局设备状态">
        <span className="global-status-device">{currentDeviceLabel}</span>
        <span className={statusChipClass(connectionLabel, "global-status-connection")}>{connectionLabel}</span>
        <span className={statusChipClass(enabledLabel)}>{enabledLabel}</span>
        <span className={statusChipClass(recordingLabel)}>{recordingLabel}</span>
        {emergencyLatched ? (
          <span aria-live="assertive" className={statusChipClass("急停锁定", "is-emergency")}>急停锁定</span>
        ) : null}
      </div>
      <div className="global-status-actions">
        {currentUserLabel && onLogout ? (
          <button
            aria-label={`退出 ${currentUserLabel}`}
            className="global-account-control"
            onClick={onLogout}
            type="button"
          >
            <LogOut size={16} />
            <span>{currentUserLabel}</span>
          </button>
        ) : null}
        <button
          aria-label="紧急停止"
          aria-pressed={emergencyLatched}
          className="emergency-stop-button"
          onClick={onEmergencyStop}
          type="button"
        >
          <OctagonX aria-hidden="true" size={18} />
          <span>紧急停止</span>
        </button>
      </div>
    </header>
  );
}

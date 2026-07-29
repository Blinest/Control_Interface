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
  return (
    <header className="global-status-bar">
      <div className="global-status-items" aria-label="全局设备状态">
        <span className="global-status-device">{currentDeviceLabel}</span>
        <span className="global-status-connection">{connectionLabel}</span>
        <span className={enabled ? "status-indicator is-enabled" : "status-indicator"}>
          {enabled ? "已使能" : "未使能"}
        </span>
        <span className={recording ? "status-indicator is-recording" : "status-indicator"}>
          {recording ? "录制中" : "未录制"}
        </span>
        {emergencyLatched ? <span aria-live="assertive" className="status-indicator is-emergency">急停锁定</span> : null}
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

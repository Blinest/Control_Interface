interface GlobalStatusBarProps {
  currentDeviceLabel: string;
  connectionLabel: string;
  enabled: boolean;
  recording: boolean;
  emergencyLatched: boolean;
  onEmergencyStop: () => void;
}

export function GlobalStatusBar({
  currentDeviceLabel,
  connectionLabel,
  enabled,
  recording,
  emergencyLatched,
  onEmergencyStop,
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
        {emergencyLatched ? <span className="status-indicator is-emergency">急停锁定</span> : null}
      </div>
      <button
        aria-label="紧急停止"
        className="emergency-stop-button"
        onClick={onEmergencyStop}
        type="button"
      >
        紧急停止
      </button>
    </header>
  );
}

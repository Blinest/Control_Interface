import {
  Cable,
  CheckCircle2,
  PauseCircle,
  RefreshCw,
  Unplug,
  Wifi,
} from "lucide-react";
import type {
  DeviceConnectionRecord,
  DeviceRuntimeStatusView,
  RuntimeSnapshot,
} from "../../softuiTypes";
import type { SystemControlAction } from "./DeviceWorkspacePage";
import { latestFrameForDevice } from "./deviceTelemetry";

export interface DeviceContextPanelProps {
  snapshot: RuntimeSnapshot;
  currentDeviceId: string;
  connectedDevices: DeviceConnectionRecord[];
  deviceStatuses: Record<string, DeviceRuntimeStatusView>;
  onSelectDevice: (deviceId: string) => void;
  onOpenConnectDialog: () => void;
  onDisconnectDevice: (deviceId: string) => void;
  onRefreshSerialPorts: () => void;
  onSystemControl: (action: SystemControlAction, deviceId: string) => void;
}

export function DeviceContextPanel({
  snapshot,
  currentDeviceId,
  connectedDevices,
  deviceStatuses,
  onSelectDevice,
  onOpenConnectDialog,
  onDisconnectDevice,
  onRefreshSerialPorts,
  onSystemControl,
}: DeviceContextPanelProps) {
  const currentConnection = connectedDevices.find((device) => device.deviceId === currentDeviceId);
  const currentRuntime = deviceStatuses[currentDeviceId];
  const frame = latestFrameForDevice(snapshot, currentDeviceId);
  const deviceOptions = currentDeviceId && !connectedDevices.some((device) => device.deviceId === currentDeviceId)
    ? [{ deviceId: currentDeviceId }, ...connectedDevices]
    : connectedDevices;
  const emergencyLatched = snapshot.runtimeDiagnostics.emergencyLatched || currentRuntime?.emergencyLatched === true;

  return (
    <section className="device-context-panel" aria-label="设备上下文">
      <header className="device-context-header">
        <Cable aria-hidden="true" size={18} />
        <div>
          <span>当前控制设备</span>
          <strong title={currentDeviceId}>{currentDeviceId || "未选择设备"}</strong>
        </div>
      </header>

      <label className="workspace-field">
        <span>设备选择</span>
        <select
          aria-label="当前控制设备"
          disabled={deviceOptions.length === 0}
          onChange={(event) => onSelectDevice(event.target.value)}
          value={currentDeviceId}
        >
          {deviceOptions.length === 0 ? <option value="">未连接设备</option> : null}
          {deviceOptions.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.deviceId}
            </option>
          ))}
        </select>
      </label>

      <div className="context-status-list">
        <div><span>连接状态</span><strong>{currentConnection?.state ?? currentRuntime?.state ?? (frame ? snapshot.connection.state : "无数据")}</strong></div>
        <div><span>使能状态</span><strong>{frame ? (frame.systemEnabled ? "已使能" : "未使能") : "无数据"}</strong></div>
        <div><span>急停状态</span><strong>{emergencyLatched ? "已锁定" : "正常"}</strong></div>
        <div><span>命令队列</span><strong>{currentRuntime?.pendingCommands ?? "无数据"}</strong></div>
        <div><span>最近帧</span><strong>{frame ? `#${frame.sequence}` : "无数据"}</strong></div>
      </div>

      <div className="context-action-stack">
        <button className="ghost-btn" onClick={onOpenConnectDialog} type="button">
          <Wifi aria-hidden="true" size={15} />
          连接设备
        </button>
        <button className="ghost-btn" onClick={onRefreshSerialPorts} type="button">
          <RefreshCw aria-hidden="true" size={15} />
          刷新串口
        </button>
        <button
          className="ghost-btn"
          disabled={!currentDeviceId || emergencyLatched}
          onClick={() => onSystemControl("enable", currentDeviceId)}
          type="button"
        >
          <CheckCircle2 aria-hidden="true" size={15} />
          使能
        </button>
        <button
          className="ghost-btn"
          disabled={!currentDeviceId}
          onClick={() => onSystemControl("disable", currentDeviceId)}
          type="button"
        >
          <PauseCircle aria-hidden="true" size={15} />
          失能
        </button>
        <button
          className="ghost-btn"
          disabled={!currentConnection}
          onClick={() => onDisconnectDevice(currentDeviceId)}
          type="button"
        >
          {currentConnection ? <Unplug aria-hidden="true" size={15} /> : <Cable aria-hidden="true" size={15} />}
          断开当前设备
        </button>
      </div>
    </section>
  );
}

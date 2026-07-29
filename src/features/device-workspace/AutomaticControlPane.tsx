import { useState } from "react";
import { Activity, PauseCircle, Play, Save } from "lucide-react";
import type {
  CycleLifeConfig,
  DeviceRuntimeStatusView,
  PidConfig,
  RuntimeSnapshot,
} from "../../softuiTypes";
import type {
  SystemControlAction,
  WorkspaceCommand,
  WorkspaceCommandPayload,
} from "./DeviceWorkspacePage";

export interface AutomaticControlPaneProps {
  snapshot: RuntimeSnapshot;
  currentDeviceId: string;
  deviceStatuses: Record<string, DeviceRuntimeStatusView>;
  onSystemControl: (action: SystemControlAction, deviceId: string) => void;
  onWorkspaceCommand: (command: WorkspaceCommand, payload: WorkspaceCommandPayload) => void;
}

export function AutomaticControlPane({
  snapshot,
  currentDeviceId,
  deviceStatuses,
  onSystemControl,
  onWorkspaceCommand,
}: AutomaticControlPaneProps) {
  const [pid, setPid] = useState<PidConfig>(snapshot.controlRuntime.pid);
  const [cycle, setCycle] = useState<CycleLifeConfig>(snapshot.controlRuntime.cycle);
  const motionLocked = snapshot.runtimeDiagnostics.emergencyLatched
    || deviceStatuses[currentDeviceId]?.emergencyLatched === true;

  const setPidNumber = (key: keyof PidConfig, value: number) => setPid((current) => ({ ...current, [key]: value }));
  const setCycleNumber = (key: keyof CycleLifeConfig, value: number) => setCycle((current) => ({ ...current, [key]: value }));

  return (
    <div className="workspace-pane-grid automatic-control-pane">
      {motionLocked ? (
        <div className="workspace-safety-banner" role="status">
          急停已锁定，主动控制和循环寿命控制不可启动。
        </div>
      ) : null}

      <section className="workspace-panel workspace-panel-wide">
        <header>
          <div><span>自动控制</span><h2>主动控制</h2></div>
          <span className={`status-chip ${snapshot.controlRuntime.active ? "is-ok" : ""}`}>
            {snapshot.controlRuntime.active ? snapshot.controlRuntime.phase : "未运行"}
          </span>
        </header>
        <div className="automatic-status-grid">
          <div><span>目标角度</span><strong>{snapshot.controlRuntime.targetAngleDeg.toFixed(1)}°</strong></div>
          <div><span>PID 输出</span><strong>{snapshot.controlRuntime.pidOutput.toFixed(3)}</strong></div>
          <div><span>电机增量</span><strong>{snapshot.controlRuntime.motorDeltaMm.toFixed(3)} mm</strong></div>
          <div><span>完成循环</span><strong>{snapshot.controlRuntime.cyclesCompleted}</strong></div>
          <div><span>允许状态</span><strong>{snapshot.controlRuntime.allowed ? "允许" : "禁止"}</strong></div>
          <div><span>运行原因</span><strong>{snapshot.controlRuntime.reason ?? "正常"}</strong></div>
        </div>
        <div className="workspace-action-row">
          <button
            className="primary-btn"
            disabled={motionLocked || !currentDeviceId}
            onClick={() => onWorkspaceCommand("activeTick", { deviceId: currentDeviceId })}
            type="button"
          >
            <Activity aria-hidden="true" size={15} />
            启动主动控制
          </button>
          <button
            className="ghost-btn"
            disabled={!currentDeviceId}
            onClick={() => onSystemControl("disable", currentDeviceId)}
            type="button"
          >
            <PauseCircle aria-hidden="true" size={15} />
            停止主动控制
          </button>
        </div>
      </section>

      <section className="workspace-panel">
        <header><div><span>自动控制</span><h2>PID 参数</h2></div></header>
        <div className="workspace-form-grid workspace-form-grid-pid">
          {([
            ["kp", "Kp"],
            ["ki", "Ki"],
            ["kd", "Kd"],
            ["deadbandDeg", "死区 (°)"],
            ["integralLimit", "积分上限"],
            ["outputLimit", "输出上限"],
            ["samplePeriodMs", "周期 (ms)"],
          ] as Array<[keyof PidConfig, string]>).map(([key, label]) => (
            <label className="workspace-field" key={key}>
              <span>{label}</span>
              <input onChange={(event) => setPidNumber(key, Number(event.target.value))} step="any" type="number" value={pid[key]} />
            </label>
          ))}
          <button
            className="ghost-btn"
            disabled={!currentDeviceId}
            onClick={() => onWorkspaceCommand("updatePid", { deviceId: currentDeviceId, pid })}
            type="button"
          >
            <Save aria-hidden="true" size={15} />
            保存 PID 参数
          </button>
        </div>
      </section>

      <section className="workspace-panel">
        <header><div><span>自动控制</span><h2>循环寿命控制</h2></div></header>
        <div className="workspace-form-grid workspace-form-grid-cycle">
          {([
            ["lowerAngleDeg", "下限角度"],
            ["upperAngleDeg", "上限角度"],
            ["toleranceDeg", "容差"],
            ["dwellMs", "停留时间 (ms)"],
            ["maxCycles", "最大循环数"],
          ] as Array<[Exclude<keyof CycleLifeConfig, "enabled">, string]>).map(([key, label]) => (
            <label className="workspace-field" key={key}>
              <span>{label}</span>
              <input onChange={(event) => setCycleNumber(key, Number(event.target.value))} step="any" type="number" value={cycle[key]} />
            </label>
          ))}
        </div>
        <div className="workspace-action-row">
          <button
            className="ghost-btn"
            disabled={!currentDeviceId}
            onClick={() => onWorkspaceCommand("configureCycle", { deviceId: currentDeviceId, cycle })}
            type="button"
          >
            <Save aria-hidden="true" size={15} />
            保存循环参数
          </button>
          <button
            className="primary-btn"
            disabled={motionLocked || !currentDeviceId}
            onClick={() => onWorkspaceCommand("startCycle", { deviceId: currentDeviceId, cycle: { ...cycle, enabled: true } })}
            type="button"
          >
            <Play aria-hidden="true" size={15} />
            启动循环控制
          </button>
          <button
            className="ghost-btn"
            disabled={!currentDeviceId}
            onClick={() => onWorkspaceCommand("stopCycle", { deviceId: currentDeviceId, reason: "operator stopped cycle life" })}
            type="button"
          >
            <PauseCircle aria-hidden="true" size={15} />
            停止循环控制
          </button>
        </div>
      </section>
    </div>
  );
}

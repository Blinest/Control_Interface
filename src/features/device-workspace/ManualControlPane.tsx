import { useState } from "react";
import { ArrowRightLeft, CheckCircle2, Home } from "lucide-react";
import type { DeviceRuntimeStatusView, RuntimeSnapshot } from "../../softuiTypes";
import type {
  MotorCommandRequest,
  WorkspaceCommand,
  WorkspaceCommandPayload,
} from "./DeviceWorkspacePage";

export interface ManualControlPaneProps {
  snapshot: RuntimeSnapshot;
  currentDeviceId: string;
  deviceStatuses: Record<string, DeviceRuntimeStatusView>;
  onSendMotor: (command: MotorCommandRequest) => void;
  onWorkspaceCommand: (command: WorkspaceCommand, payload: WorkspaceCommandPayload) => void;
}

export function ManualControlPane({
  snapshot,
  currentDeviceId,
  deviceStatuses,
  onSendMotor,
  onWorkspaceCommand,
}: ManualControlPaneProps) {
  const [motor, setMotor] = useState({
    motorId: 1,
    positionMm: 0,
    velocityMmPerSec: 10,
    accelerationMmPerSec2: 3,
  });
  const [sensor, setSensor] = useState({ sensorId: 1, calibrationValue: 0 });
  const [bend, setBend] = useState({
    direction1: 0,
    angle1Deg: snapshot.calibration.targetAngles[0],
    direction2: 0,
    angle2Deg: snapshot.calibration.targetAngles[1],
  });
  const currentFrame = snapshot.live.frames.find((frame) => frame.deviceId === currentDeviceId)
    ?? snapshot.live.frames[0];
  const motionLocked = snapshot.runtimeDiagnostics.emergencyLatched
    || deviceStatuses[currentDeviceId]?.emergencyLatched === true;

  return (
    <div className="workspace-pane-grid manual-control-pane">
      {motionLocked ? (
        <div className="workspace-safety-banner" role="status">
          急停已锁定，当前设备的运动控制不可用。
        </div>
      ) : null}

      <section className="workspace-panel workspace-panel-wide">
        <header>
          <div><span>手动控制</span><h2>电机与弯曲控制</h2></div>
        </header>
        <div className="workspace-form-grid workspace-form-grid-motor">
          <label className="workspace-field">
            <span>电机通道</span>
            <input min={1} max={6} onChange={(event) => setMotor((value) => ({ ...value, motorId: Number(event.target.value) }))} type="number" value={motor.motorId} />
          </label>
          <label className="workspace-field">
            <span>目标位置 (mm)</span>
            <input onChange={(event) => setMotor((value) => ({ ...value, positionMm: Number(event.target.value) }))} step={0.1} type="number" value={motor.positionMm} />
          </label>
          <label className="workspace-field">
            <span>速度 (mm/s)</span>
            <input min={0} onChange={(event) => setMotor((value) => ({ ...value, velocityMmPerSec: Number(event.target.value) }))} step={0.1} type="number" value={motor.velocityMmPerSec} />
          </label>
          <label className="workspace-field">
            <span>加速度 (mm/s²)</span>
            <input min={0} onChange={(event) => setMotor((value) => ({ ...value, accelerationMmPerSec2: Number(event.target.value) }))} step={0.1} type="number" value={motor.accelerationMmPerSec2} />
          </label>
          <button
            className="primary-btn"
            disabled={motionLocked || !currentDeviceId}
            onClick={() => onSendMotor({ deviceId: currentDeviceId, ...motor })}
            type="button"
          >
            <ArrowRightLeft aria-hidden="true" size={15} />
            发送电机命令
          </button>
          <button
            className="ghost-btn"
            disabled={motionLocked || !currentDeviceId}
            onClick={() => onWorkspaceCommand("home", { deviceId: currentDeviceId })}
            type="button"
          >
            <Home aria-hidden="true" size={15} />
            全部回零
          </button>
        </div>

        <div className="motor-state-strip" aria-label="电机当前状态">
          {currentFrame?.motors.map((item) => (
            <div key={item.id}>
              <span>电机 {item.id}</span>
              <strong>{item.positionMm.toFixed(1)} mm</strong>
              <small>{item.running ? "运行" : "停止"}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="workspace-panel">
        <header><div><span>手动控制</span><h2>传感器校准</h2></div></header>
        <div className="workspace-form-grid">
          <label className="workspace-field">
            <span>传感器</span>
            <input min={1} max={6} onChange={(event) => setSensor((value) => ({ ...value, sensorId: Number(event.target.value) }))} type="number" value={sensor.sensorId} />
          </label>
          <label className="workspace-field">
            <span>校准值</span>
            <input onChange={(event) => setSensor((value) => ({ ...value, calibrationValue: Number(event.target.value) }))} step={0.01} type="number" value={sensor.calibrationValue} />
          </label>
          <button
            className="ghost-btn"
            disabled={!currentDeviceId}
            onClick={() => onWorkspaceCommand("calibrateSensor", { deviceId: currentDeviceId, ...sensor })}
            type="button"
          >
            <CheckCircle2 aria-hidden="true" size={15} />
            发送校准
          </button>
        </div>
      </section>

      <section className="workspace-panel">
        <header><div><span>手动控制</span><h2>弯曲命令</h2></div></header>
        <div className="workspace-form-grid workspace-form-grid-bend">
          <label className="workspace-field">
            <span>方向 1</span>
            <select onChange={(event) => setBend((value) => ({ ...value, direction1: Number(event.target.value) }))} value={bend.direction1}>
              <option value={0}>上</option><option value={1}>下</option><option value={2}>左</option><option value={3}>右</option>
            </select>
          </label>
          <label className="workspace-field">
            <span>角度 1</span>
            <input min={0} max={90} onChange={(event) => setBend((value) => ({ ...value, angle1Deg: Number(event.target.value) }))} step={0.1} type="number" value={bend.angle1Deg} />
          </label>
          <label className="workspace-field">
            <span>方向 2</span>
            <select onChange={(event) => setBend((value) => ({ ...value, direction2: Number(event.target.value) }))} value={bend.direction2}>
              <option value={0}>上</option><option value={1}>下</option><option value={2}>左</option><option value={3}>右</option>
            </select>
          </label>
          <label className="workspace-field">
            <span>角度 2</span>
            <input min={0} max={90} onChange={(event) => setBend((value) => ({ ...value, angle2Deg: Number(event.target.value) }))} step={0.1} type="number" value={bend.angle2Deg} />
          </label>
          <button
            className="primary-btn"
            disabled={motionLocked || !currentDeviceId}
            onClick={() => onWorkspaceCommand("bend", { deviceId: currentDeviceId, ...bend })}
            type="button"
          >
            <ArrowRightLeft aria-hidden="true" size={15} />
            发送弯曲命令
          </button>
        </div>
      </section>
    </div>
  );
}

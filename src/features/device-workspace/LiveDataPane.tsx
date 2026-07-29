import type { RuntimeSnapshot } from "../../softuiTypes";
import { framesForDevice } from "./deviceTelemetry";

export interface LiveDataPaneProps {
  snapshot: RuntimeSnapshot;
  currentDeviceId: string;
}

function formatReceivedAt(receivedAtMs: number) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date(receivedAtMs));
}

export function LiveDataPane({ snapshot, currentDeviceId }: LiveDataPaneProps) {
  const frames = framesForDevice(snapshot, currentDeviceId);
  const motorRows = frames.flatMap((frame) => frame.motors.map((motor) => ({ frame, motor })));
  const sensorRows = frames.flatMap((frame) => frame.sensors.map((sensor) => ({ frame, sensor })));

  return (
    <div className="workspace-pane-grid live-data-pane">
      <section className="workspace-panel workspace-panel-wide">
        <header><div><span>实时数据</span><h2>电机快照</h2></div></header>
        <div className="workspace-table" role="table" aria-label="当前设备电机快照">
          <div className="workspace-table-row is-head" role="row">
            <span>时间</span><span>帧号</span><span>电机</span><span>位置</span><span>速度</span><span>状态</span>
          </div>
          {motorRows.map(({ frame, motor }) => (
            <div className="workspace-table-row" key={`${frame.sequence}-${motor.id}`} role="row">
              <span>{formatReceivedAt(frame.receivedAtMs)}</span>
              <span>#{frame.sequence}</span>
              <span>{motor.id}</span>
              <span>{motor.positionMm.toFixed(2)} mm</span>
              <span>{motor.velocityMmPerSec.toFixed(2)} mm/s</span>
              <span>{motor.running ? "运行" : "停止"}</span>
            </div>
          ))}
          {motorRows.length === 0 ? (
            <div className="feature-empty-compact">当前设备没有电机数据</div>
          ) : null}
        </div>
      </section>

      <section className="workspace-panel workspace-panel-wide">
        <header><div><span>实时数据</span><h2>传感器快照</h2></div></header>
        <div className="workspace-table" role="table" aria-label="当前设备传感器快照">
          <div className="workspace-table-row is-head" role="row">
            <span>时间</span><span>帧号</span><span>传感器</span><span>X</span><span>Y</span><span>Z</span>
          </div>
          {sensorRows.map(({ frame, sensor }) => (
            <div className="workspace-table-row" key={`${frame.sequence}-sensor-${sensor.id}`} role="row">
              <span>{formatReceivedAt(frame.receivedAtMs)}</span>
              <span>#{frame.sequence}</span>
              <span>{sensor.id}</span>
              <span>{sensor.filtered[0].toFixed(2)}</span>
              <span>{sensor.filtered[1].toFixed(2)}</span>
              <span>{sensor.filtered[2].toFixed(2)}</span>
            </div>
          ))}
          {sensorRows.length === 0 ? (
            <div className="feature-empty-compact">当前设备没有传感器数据</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

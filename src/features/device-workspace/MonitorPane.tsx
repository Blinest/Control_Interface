import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Box,
  Cpu,
  Gauge,
  ListOrdered,
  Pencil,
  Radio,
} from "lucide-react";
import { CardLayoutEditor, cardSizeClass } from "../../components/cards/CardLayoutEditor";
import RobotScene from "../../RobotScene";
import type {
  DeviceRuntimeStatusView,
  MonitorCardId,
  PageLayout,
  RecorderStatus,
  RuntimeSnapshot,
  SessionInfo,
} from "../../softuiTypes";
import {
  loadLayout,
  resetLayout,
  saveLayout,
} from "../../state/layoutStore";
import { framesForDevice, latestFrameForDevice } from "./deviceTelemetry";

export interface MonitorPaneProps {
  snapshot: RuntimeSnapshot;
  currentDeviceId: string;
  deviceStatuses: Record<string, DeviceRuntimeStatusView>;
  recorderStatus: RecorderStatus;
  sessions: SessionInfo[];
}

interface MonitorCardContext extends MonitorPaneProps {}

interface MonitorCardDefinition {
  title: string;
  icon: typeof Activity;
  render: (context: MonitorCardContext) => ReactNode;
}

function LiveChartCard({
  snapshot,
  currentDeviceId,
}: Pick<MonitorPaneProps, "snapshot" | "currentDeviceId">) {
  const frames = framesForDevice(snapshot, currentDeviceId).slice(0, 36).reverse();
  const motorId = frames[frames.length - 1]?.motors[0]?.id;
  const points = motorId === undefined
    ? []
    : frames.flatMap((frame) => {
      const motor = frame.motors.find((candidate) => candidate.id === motorId);
      return motor ? [motor.positionMm] : [];
    });

  if (points.length === 0) {
    return <div className="feature-empty-compact">当前设备没有实时图表数据</div>;
  }

  const maxMagnitude = Math.max(...points.map((value) => Math.abs(value)), 1);
  return (
    <div className="monitor-chart" aria-label="当前通道实时趋势">
      <div className="monitor-chart-bars" aria-hidden="true">
        {points.map((value, index) => (
          <span
            key={`${index}-${value}`}
            style={{ height: `${Math.max(4, Math.abs(value) / maxMagnitude * 100)}%` }}
          />
        ))}
      </div>
      <div className="monitor-chart-meta">
        <span>电机 {motorId} 位置</span>
        <strong>{points[points.length - 1].toFixed(2)} mm</strong>
      </div>
    </div>
  );
}

function ModelCard({ snapshot, currentDeviceId }: Pick<MonitorPaneProps, "snapshot" | "currentDeviceId">) {
  const frame = latestFrameForDevice(snapshot, currentDeviceId);
  if (!frame) {
    return <div className="feature-empty-compact">当前设备没有三维姿态数据</div>;
  }
  return (
    <RobotScene
      section1AngleDeg={frame.bend.section1.angleDeg}
      section2AngleDeg={frame.bend.section2.angleDeg}
    />
  );
}

export const monitorCardRegistry: Record<MonitorCardId, MonitorCardDefinition> = {
  liveChart: {
    title: "实时图表",
    icon: Activity,
    render: ({ snapshot, currentDeviceId }) => (
      <LiveChartCard currentDeviceId={currentDeviceId} snapshot={snapshot} />
    ),
  },
  model3d: {
    title: "三维模型",
    icon: Box,
    render: ({ snapshot, currentDeviceId }) => <ModelCard currentDeviceId={currentDeviceId} snapshot={snapshot} />,
  },
  deviceState: {
    title: "设备状态",
    icon: Gauge,
    render: ({ snapshot, currentDeviceId, deviceStatuses }) => {
      const frame = latestFrameForDevice(snapshot, currentDeviceId);
      const status = deviceStatuses[currentDeviceId];
      return (
        <div className="feature-metric-grid">
          <div className="feature-metric"><span>连接</span><strong>{status?.state ?? (frame ? snapshot.connection.state : "无数据")}</strong></div>
          <div className="feature-metric"><span>帧号</span><strong>{frame ? `#${frame.sequence}` : "-"}</strong></div>
          <div className="feature-metric"><span>使能</span><strong>{frame ? (frame.systemEnabled ? "是" : "否") : "无数据"}</strong></div>
          <div className="feature-metric"><span>延迟</span><strong>{frame ? `${frame.quality.latencyMs} ms` : "-"}</strong></div>
        </div>
      );
    },
  },
  commandQueue: {
    title: "命令队列",
    icon: ListOrdered,
    render: ({ currentDeviceId, deviceStatuses }) => {
      const status = deviceStatuses[currentDeviceId];
      return (
        <div className="feature-metric-grid">
          <div className="feature-metric"><span>等待命令</span><strong>{status?.pendingCommands ?? "无数据"}</strong></div>
          <div className="feature-metric"><span>已发送</span><strong>{status?.sentCommands ?? "无数据"}</strong></div>
          <div className="feature-metric"><span>峰值</span><strong>{status?.commandHighWatermark ?? "-"}</strong></div>
          <div className="feature-metric"><span>协议错误</span><strong>{status?.protocolErrors ?? "无数据"}</strong></div>
        </div>
      );
    },
  },
  motorSummary: {
    title: "电机摘要",
    icon: Cpu,
    render: ({ snapshot, currentDeviceId }) => {
      const frame = latestFrameForDevice(snapshot, currentDeviceId);
      return frame && frame.motors.length > 0 ? (
        <div className="monitor-summary-grid">
          {frame.motors.map((motor) => (
            <div key={motor.id}>
              <span>M{motor.id}</span>
              <strong>{motor.positionMm.toFixed(1)} mm</strong>
              <small>{motor.running ? "运行" : "停止"}</small>
            </div>
          ))}
        </div>
      ) : <div className="feature-empty-compact">当前设备没有电机数据</div>;
    },
  },
  sensorSummary: {
    title: "传感器摘要",
    icon: Radio,
    render: ({ snapshot, currentDeviceId }) => {
      const frame = latestFrameForDevice(snapshot, currentDeviceId);
      return frame && frame.sensors.length > 0 ? (
        <div className="monitor-summary-grid">
          {frame.sensors.map((sensor) => (
            <div key={sensor.id}>
              <span>S{sensor.id}</span>
              <strong>{sensor.filtered[0].toFixed(2)}</strong>
              <small>{sensor.quality}</small>
            </div>
          ))}
        </div>
      ) : <div className="feature-empty-compact">当前设备没有传感器数据</div>;
    },
  },
  recentAlerts: {
    title: "最近告警",
    icon: AlertTriangle,
    render: ({ snapshot, currentDeviceId }) => {
      const alerts = snapshot.logs.filter((entry) => (
        (entry.level === "warn" || entry.level === "error")
        && (!entry.deviceId || entry.deviceId === currentDeviceId)
      )).slice(0, 5);
      return alerts.length > 0 ? (
        <div className="feature-list">
          {alerts.map((entry) => (
            <div className="feature-list-row feature-list-row-event" key={entry.id}>
              <span className={`status-chip is-${entry.level}`}>{entry.level.toUpperCase()}</span>
              <span>{entry.scope}</span>
              <span title={entry.message}>{entry.message}</span>
            </div>
          ))}
        </div>
      ) : <div className="feature-empty-compact">当前设备没有最近告警</div>;
    },
  },
};

export function MonitorPane(props: MonitorPaneProps) {
  const username = props.snapshot.authSession.username;
  const [layout, setLayout] = useState<PageLayout>(() => loadLayout(username, "workspace-monitor"));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setLayout(loadLayout(username, "workspace-monitor"));
    setEditing(false);
  }, [username]);

  const save = (nextLayout: PageLayout) => {
    saveLayout(username, "workspace-monitor", nextLayout);
    setLayout(loadLayout(username, "workspace-monitor"));
    setEditing(false);
  };

  const reset = () => {
    resetLayout(username, "workspace-monitor");
    setLayout(loadLayout(username, "workspace-monitor"));
    setEditing(false);
  };

  return (
    <div className="feature-page-stack monitor-pane">
      <div className="workspace-local-toolbar">
        <div>
          <span>设备监控</span>
          <strong title={props.currentDeviceId}>{props.currentDeviceId || "未选择设备"}</strong>
        </div>
        <button className="ghost-btn" onClick={() => setEditing((value) => !value)} type="button">
          <Pencil aria-hidden="true" size={16} />
          编辑布局
        </button>
      </div>

      <div className="feature-card-grid monitor-card-grid" aria-label="设备监控卡片">
        {layout.cards.filter((card) => card.visible).map((card) => {
          const definition = monitorCardRegistry[card.id as MonitorCardId];
          const Icon = definition.icon;
          return (
            <article className={`feature-card monitor-card ${cardSizeClass[card.size]}`} key={card.id}>
              <header className="feature-card-header">
                <div><Icon aria-hidden="true" size={17} /><h2>{definition.title}</h2></div>
              </header>
              <div className={`feature-card-body ${card.id === "model3d" ? "model-card-body" : ""}`}>
                {definition.render(props)}
              </div>
            </article>
          );
        })}
      </div>

      {editing ? (
        <div className="layout-editor-panel">
          <CardLayoutEditor
            key={`${username}:${JSON.stringify(layout)}`}
            layout={layout}
            onCancel={() => setEditing(false)}
            onReset={reset}
            onSave={save}
          />
        </div>
      ) : null}
    </div>
  );
}

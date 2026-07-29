import { useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { CardLayoutEditor, cardSizeClass } from "../../components/cards/CardLayoutEditor";
import { DashboardLayout } from "../../layouts/DashboardLayout";
import type {
  DashboardCardId,
  DeviceConnectionRecord,
  DeviceRuntimeStatusView,
  PageLayout,
  RecorderStatus,
  RuntimeSnapshot,
  SessionInfo,
} from "../../softuiTypes";
import {
  defaultDashboardLayout,
  loadLayout,
  resetLayout,
  saveLayout,
} from "../../state/layoutStore";
import { dashboardCardRegistry } from "./dashboardCards";
import "./dashboard.css";

export interface DashboardPageProps {
  snapshot: RuntimeSnapshot;
  connectedDevices: DeviceConnectionRecord[];
  deviceStatuses: Record<string, DeviceRuntimeStatusView>;
  recorderStatus: RecorderStatus;
  sessions: SessionInfo[];
}

export function DashboardPage({
  snapshot,
  connectedDevices,
  deviceStatuses,
  recorderStatus,
  sessions,
}: DashboardPageProps) {
  const username = snapshot.authSession.username;
  const [layout, setLayout] = useState<PageLayout>(() => loadLayout(username, "dashboard"));
  const [editing, setEditing] = useState(false);
  const currentFrame = snapshot.live.frames.find((frame) => frame.deviceId === snapshot.live.selectedDeviceId)
    ?? snapshot.live.frames[0];

  useEffect(() => {
    setLayout(loadLayout(username, "dashboard"));
    setEditing(false);
  }, [username]);

  const save = (nextLayout: PageLayout) => {
    saveLayout(username, "dashboard", nextLayout);
    setLayout(loadLayout(username, "dashboard"));
    setEditing(false);
  };

  const reset = () => {
    resetLayout(username, "dashboard");
    setLayout(loadLayout(username, "dashboard"));
    setEditing(false);
  };

  const summary = (
    <div className="dashboard-summary-bar" aria-label="全局设备摘要">
      <div className="dashboard-summary-heading">
        <span>运行总览</span>
        <strong>{snapshot.live.selectedDeviceId || "未选择设备"}</strong>
      </div>
      <div className="critical-status-strip">
        <div><span>当前控制设备</span><strong>{snapshot.live.selectedDeviceId || "未选择"}</strong></div>
        <div><span>连接状态</span><strong>{snapshot.connection.state}</strong></div>
        <div><span>使能状态</span><strong>{currentFrame?.systemEnabled ? "已使能" : "未使能"}</strong></div>
        <div><span>急停状态</span><strong>{snapshot.runtimeDiagnostics.emergencyLatched ? "已锁定" : "正常"}</strong></div>
      </div>
      <button className="ghost-btn" onClick={() => setEditing((value) => !value)} type="button">
        <Pencil aria-hidden="true" size={16} />
        编辑布局
      </button>
    </div>
  );

  return (
    <DashboardLayout summary={summary}>
      <div className="feature-page-stack">
        <div className="feature-card-grid" aria-label="总览卡片">
          {layout.cards.filter((card) => card.visible).map((card) => {
            const definition = dashboardCardRegistry[card.id as DashboardCardId];
            const Icon = definition.icon;
            return (
              <article className={`feature-card ${cardSizeClass[card.size]}`} key={card.id}>
                <header className="feature-card-header">
                  <div>
                    <Icon aria-hidden="true" size={17} />
                    <h2>{definition.title}</h2>
                  </div>
                </header>
                <div className="feature-card-body">
                  {definition.render({ snapshot, connectedDevices, deviceStatuses, recorderStatus, sessions })}
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
    </DashboardLayout>
  );
}

export { defaultDashboardLayout };

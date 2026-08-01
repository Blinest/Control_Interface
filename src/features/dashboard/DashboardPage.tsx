import { useEffect, useState } from "react";
import { DirectCardLayout } from "../../components/cards/CardLayoutEditor";
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
  saveLayout,
} from "../../state/layoutStore";
import { dashboardCardRegistry } from "./dashboardCards";
import { latestFrameForDevice } from "../device-workspace/deviceTelemetry";
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
  const currentDeviceId = snapshot.live.selectedDeviceId;
  const currentFrame = latestFrameForDevice(snapshot, currentDeviceId);
  const currentConnection = connectedDevices.find((device) => device.deviceId === currentDeviceId);
  const currentRuntime = deviceStatuses[currentDeviceId];
  const currentConnectionState = currentConnection?.state
    ?? currentRuntime?.state
    ?? (currentFrame ? snapshot.connection.state : "无数据");
  const globalFault = snapshot.runtimeDiagnostics.lastError
    ?? snapshot.dashboard.lastError
    ?? snapshot.runtimeDiagnostics.lastProtocolError
    ?? "无";

  useEffect(() => {
    setLayout(loadLayout(username, "dashboard"));
  }, [username]);

  const save = (nextLayout: PageLayout) => {
    saveLayout(username, "dashboard", nextLayout);
    setLayout(loadLayout(username, "dashboard"));
  };

  const summary = (
    <div className="dashboard-summary-bar" aria-label="全局设备摘要">
      <div className="dashboard-summary-heading">
        <span>运行总览</span>
        <strong>{currentDeviceId || "未选择设备"}</strong>
      </div>
      <div className="critical-status-strip">
        <div><span>当前控制设备</span><strong>{currentDeviceId || "未选择"}</strong></div>
        <div><span>连接状态</span><strong>{currentConnectionState}</strong></div>
        <div><span>使能状态</span><strong>{currentFrame ? (currentFrame.systemEnabled ? "已使能" : "未使能") : "无数据"}</strong></div>
        <div><span>急停状态</span><strong>{snapshot.runtimeDiagnostics.emergencyLatched ? "已锁定" : "正常"}</strong></div>
        <div><span>全局故障</span><strong title={globalFault}>{globalFault}</strong></div>
      </div>
    </div>
  );

  return (
    <DashboardLayout summary={summary}>
      <div className="feature-page-stack">
        <DirectCardLayout
          layout={layout}
          onLayoutChange={save}
          childrenForCard={(card) => {
            const definition = dashboardCardRegistry[card.id as DashboardCardId];
            const Icon = definition.icon;
            return (
              <>
                <header className="feature-card-header">
                  <div>
                    <Icon aria-hidden="true" size={17} />
                    <h2>{definition.title}</h2>
                  </div>
                </header>
                <div className="feature-card-body">
                  {definition.render({ snapshot, connectedDevices, deviceStatuses, recorderStatus, sessions })}
                </div>
              </>
            );
          }}
        />
      </div>
    </DashboardLayout>
  );
}

export { defaultDashboardLayout };

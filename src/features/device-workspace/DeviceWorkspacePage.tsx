import { useState } from "react";
import {
  Activity,
  Bot,
  Database,
  Play,
  SlidersHorizontal,
} from "lucide-react";
import { WorkbenchLayout } from "../../layouts/WorkbenchLayout";
import type {
  CycleLifeConfig,
  DeviceConnectionRecord,
  DeviceRuntimeStatusView,
  PidConfig,
  PlaybackStatus,
  RecorderStatus,
  RuntimeSnapshot,
  SessionInfo,
} from "../../softuiTypes";
import { AutomaticControlPane } from "./AutomaticControlPane";
import { DeviceContextPanel } from "./DeviceContextPanel";
import { LiveDataPane } from "./LiveDataPane";
import { ManualControlPane } from "./ManualControlPane";
import { MonitorPane } from "./MonitorPane";
import { PlaybackPane } from "./PlaybackPane";
import "../dashboard/dashboard.css";
import "./deviceWorkspace.css";

export type WorkspaceTab = "monitor" | "live-data" | "manual" | "automatic" | "playback";
export type SystemControlAction = "enable" | "disable" | "emergencyStop";
export type WorkspaceCommand =
  | "home"
  | "calibrateSensor"
  | "bend"
  | "activeTick"
  | "updatePid"
  | "configureCycle"
  | "startCycle"
  | "stopCycle"
  | "loadPlayback"
  | "playbackToggle"
  | "playbackStop"
  | "playbackSeek"
  | "playbackSpeed";

export interface MotorCommandRequest {
  deviceId: string;
  motorId: number;
  positionMm: number;
  velocityMmPerSec: number;
  accelerationMmPerSec2: number;
}

export interface WorkspaceCommandPayload {
  deviceId: string;
  sensorId?: number;
  calibrationValue?: number;
  direction1?: number;
  angle1Deg?: number;
  direction2?: number;
  angle2Deg?: number;
  pid?: PidConfig;
  cycle?: CycleLifeConfig;
  reason?: string;
  sessionId?: string;
  ms?: number;
  speed?: number;
}

export interface DeviceWorkspacePageProps {
  snapshot: RuntimeSnapshot;
  currentDeviceId: string;
  connectedDevices: DeviceConnectionRecord[];
  deviceStatuses: Record<string, DeviceRuntimeStatusView>;
  recorderStatus: RecorderStatus;
  sessions: SessionInfo[];
  playbackStatus: PlaybackStatus | null;
  onSelectDevice: (deviceId: string) => void;
  onOpenConnectDialog: () => void;
  onDisconnectDevice: (deviceId: string) => void;
  onRefreshSerialPorts: () => void;
  onSystemControl: (action: SystemControlAction, deviceId: string) => void;
  onSendMotor: (command: MotorCommandRequest) => void;
  onWorkspaceCommand: (command: WorkspaceCommand, payload: WorkspaceCommandPayload) => void;
}

const workspaceTabs = [
  { key: "monitor" as const, label: "监控", icon: Activity },
  { key: "live-data" as const, label: "实时数据", icon: Database },
  { key: "manual" as const, label: "手动控制", icon: SlidersHorizontal },
  { key: "automatic" as const, label: "自动控制", icon: Bot },
  { key: "playback" as const, label: "回放", icon: Play },
];

export function DeviceWorkspacePage(props: DeviceWorkspacePageProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("monitor");
  const activeDefinition = workspaceTabs.find((tab) => tab.key === activeTab) ?? workspaceTabs[0];
  const context = (
    <DeviceContextPanel
      connectedDevices={props.connectedDevices}
      currentDeviceId={props.currentDeviceId}
      deviceStatuses={props.deviceStatuses}
      onDisconnectDevice={props.onDisconnectDevice}
      onOpenConnectDialog={props.onOpenConnectDialog}
      onRefreshSerialPorts={props.onRefreshSerialPorts}
      onSelectDevice={props.onSelectDevice}
      onSystemControl={props.onSystemControl}
      snapshot={props.snapshot}
    />
  );
  const tabs = (
    <div className="workspace-page-tabs" role="tablist" aria-label="设备工作台视图">
      {workspaceTabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button
            aria-controls={`workspace-panel-${tab.key}`}
            aria-selected={activeTab === tab.key}
            className={`workspace-page-tab${activeTab === tab.key ? " is-active" : ""}`}
            id={`workspace-tab-${tab.key}`}
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            role="tab"
            type="button"
          >
            <Icon aria-hidden="true" size={15} />
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <WorkbenchLayout context={context} tabs={tabs}>
      <div
        aria-labelledby={`workspace-tab-${activeTab}`}
        className="workspace-active-pane"
        id={`workspace-panel-${activeTab}`}
        role="tabpanel"
      >
        {activeTab === "monitor" ? (
          <MonitorPane
            currentDeviceId={props.currentDeviceId}
            deviceStatuses={props.deviceStatuses}
            recorderStatus={props.recorderStatus}
            sessions={props.sessions}
            snapshot={props.snapshot}
          />
        ) : null}
        {activeTab === "live-data" ? (
          <LiveDataPane currentDeviceId={props.currentDeviceId} snapshot={props.snapshot} />
        ) : null}
        {activeTab === "manual" ? (
          <ManualControlPane
            key={props.currentDeviceId}
            currentDeviceId={props.currentDeviceId}
            deviceStatuses={props.deviceStatuses}
            onSendMotor={props.onSendMotor}
            onWorkspaceCommand={props.onWorkspaceCommand}
            snapshot={props.snapshot}
          />
        ) : null}
        {activeTab === "automatic" ? (
          <AutomaticControlPane
            key={props.currentDeviceId}
            currentDeviceId={props.currentDeviceId}
            deviceStatuses={props.deviceStatuses}
            onSystemControl={props.onSystemControl}
            onWorkspaceCommand={props.onWorkspaceCommand}
            snapshot={props.snapshot}
          />
        ) : null}
        {activeTab === "playback" ? (
          <PlaybackPane
            currentDeviceId={props.currentDeviceId}
            onWorkspaceCommand={props.onWorkspaceCommand}
            playbackStatus={props.playbackStatus}
            recorderStatus={props.recorderStatus}
            sessions={props.sessions}
          />
        ) : null}
      </div>
      <span className="sr-only" aria-live="polite">当前视图：{activeDefinition.label}</span>
    </WorkbenchLayout>
  );
}

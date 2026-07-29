import { Play } from "lucide-react";
import PlaybackBar from "../../components/PlaybackBar";
import type {
  PlaybackStatus,
  RecorderStatus,
  SessionInfo,
} from "../../softuiTypes";
import type {
  WorkspaceCommand,
  WorkspaceCommandPayload,
} from "./DeviceWorkspacePage";
import { isPlaybackForDevice, sessionBelongsToDevice } from "./devicePlayback";

export interface PlaybackPaneProps {
  currentDeviceId: string;
  recorderStatus: RecorderStatus;
  sessions: SessionInfo[];
  playbackStatus: PlaybackStatus | null;
  onWorkspaceCommand: (command: WorkspaceCommand, payload: WorkspaceCommandPayload) => void;
}

export function PlaybackPane({
  currentDeviceId,
  recorderStatus,
  sessions,
  playbackStatus,
  onWorkspaceCommand,
}: PlaybackPaneProps) {
  const currentSessions = sessions.filter((session) => sessionBelongsToDevice(session, currentDeviceId));
  const currentPlaybackActive = isPlaybackForDevice(playbackStatus, sessions, currentDeviceId);
  const foreignPlaybackActive = playbackStatus?.active === true && !currentPlaybackActive;

  return (
    <div className="workspace-pane-grid playback-pane">
      <section className="workspace-panel workspace-panel-wide">
        <header>
          <div><span>回放</span><h2>当前设备会话</h2></div>
          <span className={`status-chip ${currentPlaybackActive ? "is-info" : ""}`}>
            {currentPlaybackActive
              ? "回放中"
              : foreignPlaybackActive
                ? "另一设备正在回放"
                : recorderStatus.active ? "正在记录" : "待选择"}
          </span>
        </header>
        {currentPlaybackActive && playbackStatus ? (
          <PlaybackBar
            status={playbackStatus}
            onPlayPause={() => onWorkspaceCommand("playbackToggle", { deviceId: currentDeviceId })}
            onStop={() => onWorkspaceCommand("playbackStop", { deviceId: currentDeviceId })}
            onSeek={(ms) => onWorkspaceCommand("playbackSeek", { deviceId: currentDeviceId, ms })}
            onStepForward={() => undefined}
            onStepBackward={() => undefined}
            onSetSpeed={(speed) => onWorkspaceCommand("playbackSpeed", { deviceId: currentDeviceId, speed })}
          />
        ) : (
          <div className="workspace-empty-state">
            <Play aria-hidden="true" size={24} />
            <strong>{foreignPlaybackActive ? "另一设备正在回放" : "尚未加载回放会话"}</strong>
            <span>
              {foreignPlaybackActive
                ? "另一设备的回放控制已隐藏。请选择属于当前设备的历史会话。"
                : "选择属于当前设备的历史会话开始回放。回放数据不会向设备发送控制命令。"}
            </span>
          </div>
        )}
      </section>

      <section className="workspace-panel workspace-panel-wide">
        <header><div><span>历史记录</span><h2>会话列表</h2></div></header>
        <div className="playback-session-list">
          {currentSessions.length > 0 ? currentSessions.map((session) => (
            <div className="playback-session-row" key={session.id}>
              <div>
                <strong title={session.name}>{session.name}</strong>
                <span>{session.frameCount.toLocaleString()} 帧 · {session.startTime}</span>
              </div>
              <button
                className="ghost-btn"
                disabled={recorderStatus.active && recorderStatus.sessionId === session.id}
                onClick={() => onWorkspaceCommand("loadPlayback", { deviceId: currentDeviceId, sessionId: session.id })}
                type="button"
              >
                <Play aria-hidden="true" size={14} />
                加载回放
              </button>
            </div>
          )) : (
            <div className="feature-empty-compact">当前设备没有可回放会话</div>
          )}
        </div>
      </section>
    </div>
  );
}

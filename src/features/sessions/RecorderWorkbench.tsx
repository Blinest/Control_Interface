import { useState } from "react";
import { Activity, PauseCircle, Play, SkipForward } from "lucide-react";
import type { RecorderStatus } from "../../softuiTypes";
import "./sessions.css";

function formatDurationSecs(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m${s}s` : `${s}s`;
}

export interface RecorderWorkbenchProps {
  recorderStatus: RecorderStatus;
  sessionsCount: number;
  onToggleRecording: () => void;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
}

export function RecorderWorkbench({
  recorderStatus,
  sessionsCount,
  onToggleRecording,
  onPauseRecording,
  onResumeRecording,
}: RecorderWorkbenchProps) {
  const [sessionName, setSessionName] = useState("");
  const currentSessionName = recorderStatus.sessionName || "无";

  return (
    <section className="recorder-workbench">
      <header className="recorder-workbench-header">
        <div>
          <div className="panel-kicker">recorder</div>
          <h2>录制工作台</h2>
        </div>
        <Activity size={16} />
      </header>

      <div className="recorder-status-list">
        <div>
          <span>状态</span>
          <strong className={recorderStatus.active ? (recorderStatus.paused ? "recorder-paused" : "recorder-active") : ""}>
            {recorderStatus.active ? (recorderStatus.paused ? "已暂停" : "录制中") : "空闲"}
          </strong>
        </div>
        {recorderStatus.active ? (
          <>
            <div>
              <span>帧数</span>
              <strong>{recorderStatus.frameCount.toLocaleString()}</strong>
            </div>
            <div>
              <span>已用时间</span>
              <strong>{formatDurationSecs(recorderStatus.elapsedSecs)}</strong>
            </div>
          </>
        ) : null}
      </div>

      <div className="recorder-actions">
        {!recorderStatus.active ? (
          <>
            <label className="recorder-name-field">
              <span>会话名称</span>
              <input
                type="text"
                placeholder="可选，留空自动命名"
                value={sessionName}
                onChange={(event) => setSessionName(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="primary-btn full"
              onClick={() => {
                onToggleRecording();
                setSessionName("");
              }}
            >
              <Activity size={16} />
              <span>开始新录制</span>
            </button>
          </>
        ) : (
          <div className="recorder-btn-group">
            {recorderStatus.paused ? (
              <button type="button" className="primary-btn full" onClick={onResumeRecording}>
                <Play size={16} />
                <span>继续录制</span>
              </button>
            ) : (
              <button type="button" className="ghost-btn full" onClick={onPauseRecording}>
                <PauseCircle size={16} />
                <span>暂停</span>
              </button>
            )}
            <button type="button" className="ghost-btn full" onClick={onToggleRecording}>
              <SkipForward size={16} />
              <span>停止录制</span>
            </button>
          </div>
        )}
      </div>

      <div className="recorder-stats">
        <div>
          <span>总会话数</span>
          <strong>{sessionsCount}</strong>
        </div>
        <div>
          <span>当前会话</span>
          <strong className="text-truncate" title={currentSessionName}>
            {currentSessionName}
          </strong>
        </div>
        <div>
          <span>保存方式</span>
          <strong>停止录制后入库</strong>
        </div>
      </div>
    </section>
  );
}

import { Database, Download, PauseCircle, Play, RefreshCw, ZoomOut } from "lucide-react";
import type { SessionInfo } from "../../softuiTypes";
import "./charts.css";

export interface ChartToolbarProps {
  sessions: SessionInfo[];
  selectedSessionId: string;
  paused: boolean;
  playbackMode: boolean;
  status: string;
  onSessionChange: (sessionId: string) => void;
  onPauseChange: (paused: boolean) => void;
  onRefresh: () => void;
  onResetZoom: () => void;
  onExportCsv: () => void;
}

export function ChartToolbar({
  sessions,
  selectedSessionId,
  paused,
  playbackMode,
  status,
  onSessionChange,
  onPauseChange,
  onRefresh,
  onResetZoom,
  onExportCsv,
}: ChartToolbarProps) {
  return (
    <div className="charts-toolbar">
      <div className="charts-toolbar-left">
        <select
          className="charts-session-select"
          value={selectedSessionId}
          onChange={(event) => onSessionChange(event.target.value)}
        >
          <option value="live">实时数据</option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {session.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className={`ghost-btn-sm ${paused ? "active" : ""}`}
          onClick={() => onPauseChange(!paused)}
        >
          {paused ? <Play size={14} /> : <PauseCircle size={14} />}
          <span>{paused ? "继续" : "暂停"}</span>
        </button>
        <button type="button" className="ghost-btn-sm" onClick={onRefresh}>
          <RefreshCw size={14} />
          <span>刷新</span>
        </button>
        <button type="button" className="ghost-btn-sm" onClick={onResetZoom}>
          <ZoomOut size={14} />
          <span>重置缩放</span>
        </button>
        <button type="button" className="ghost-btn-sm" onClick={onExportCsv}>
          <Download size={14} />
          <span>导出 CSV</span>
        </button>
        {playbackMode ? (
          <span className="playback-mode-badge">
            <Database size={14} />
            <span>回放模式</span>
          </span>
        ) : null}
      </div>
      <div className="charts-toolbar-status">{status}</div>
    </div>
  );
}

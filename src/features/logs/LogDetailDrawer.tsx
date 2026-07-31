import { X } from "lucide-react";
import { PathValue } from "../../components/data/PathValue";
import { StatusBadge, type StatusBadgeTone } from "../../components/data/StatusBadge";
import type { LogEntry } from "../../softuiTypes";
import { toVisibleLevel, type VisibleLogLevel } from "./logFilters";
import "./logs.css";

export interface LogDetailDrawerProps {
  entry: LogEntry | null;
  onClose: () => void;
}

const toneForLevel = (level: VisibleLogLevel): StatusBadgeTone =>
  level === "warning" ? "warning" : level === "error" ? "error" : level === "info" ? "info" : "bug";

export function LogDetailDrawer({ entry, onClose }: LogDetailDrawerProps) {
  if (!entry) return null;

  return (
    <div className="log-detail-drawer">
      <header className="log-detail-head">
        <div>
          <span>日志详情</span>
          <h3>{entry.scope}</h3>
        </div>
        <button type="button" className="ghost-btn-sm" onClick={onClose} aria-label="关闭日志详情">
          <X size={14} />
        </button>
      </header>
      <dl className="log-detail-list">
        <div>
          <dt>级别</dt>
          <dd><StatusBadge label={toVisibleLevel(entry.level)} tone={toneForLevel(toVisibleLevel(entry.level))} /></dd>
        </div>
        <div>
          <dt>时间</dt>
          <dd>{new Date(entry.timestampMs).toLocaleString("zh-CN")}</dd>
        </div>
        <div>
          <dt>模块</dt>
          <dd>{entry.scope}</dd>
        </div>
        <div>
          <dt>设备</dt>
          <dd>{entry.deviceId ?? "无"}</dd>
        </div>
        <div>
          <dt>原始帧</dt>
          <dd><PathValue value={entry.frameHex ?? "无"} /></dd>
        </div>
        <div className="log-detail-message-row">
          <dt>完整消息</dt>
          <dd className="log-detail-message">{entry.message}</dd>
        </div>
      </dl>
    </div>
  );
}

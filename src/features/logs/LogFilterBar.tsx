import { Download, Search, X } from "lucide-react";
import { VISIBLE_LOG_LEVELS, type VisibleLogLevel } from "./logFilters";
import "./logs.css";

export interface LogFilterBarProps {
  selectedLevels: VisibleLogLevel[];
  query: string;
  totalCount: number;
  visibleCount: number;
  onLevelsChange: (levels: VisibleLogLevel[]) => void;
  onQueryChange: (query: string) => void;
  onExportDiagnostics: () => void;
}

export function LogFilterBar({
  selectedLevels,
  query,
  totalCount,
  visibleCount,
  onLevelsChange,
  onQueryChange,
  onExportDiagnostics,
}: LogFilterBarProps) {
  const toggleLevel = (level: VisibleLogLevel) => {
    onLevelsChange(
      selectedLevels.includes(level)
        ? selectedLevels.filter((item) => item !== level)
        : [...selectedLevels, level],
    );
  };

  return (
    <div className="logs-toolbar">
      <div className="logs-level-filters" aria-label="日志级别筛选">
        {VISIBLE_LOG_LEVELS.map((level) => (
          <label className="log-level-check" key={level}>
            <input
              type="checkbox"
              checked={selectedLevels.includes(level)}
              onChange={() => toggleLevel(level)}
            />
            <span>{level}</span>
          </label>
        ))}
      </div>
      <div className="logs-search">
        <Search size={14} />
        <input
          type="text"
          placeholder="搜索消息/模块/设备"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {query ? (
          <button type="button" className="ghost-btn-sm" onClick={() => onQueryChange("")}>
            <X size={12} />
          </button>
        ) : null}
      </div>
      <button type="button" className="ghost-btn-sm" onClick={onExportDiagnostics}>
        <Download size={14} />
        <span>导出诊断</span>
      </button>
      <div className="logs-count">
        <span>{visibleCount} / {totalCount}</span>
      </div>
    </div>
  );
}

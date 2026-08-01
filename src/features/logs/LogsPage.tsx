import { useMemo, useState } from "react";
import { Logs } from "lucide-react";
import { EmptyState } from "../../components/data/EmptyState";
import { StatusBadge, type StatusBadgeTone } from "../../components/data/StatusBadge";
import { TableLayout } from "../../layouts/TableLayout";
import type { LogEntry } from "../../softuiTypes";
import { LogDetailDrawer } from "./LogDetailDrawer";
import { LogFilterBar } from "./LogFilterBar";
import {
  filterLogs,
  toVisibleLevel,
  VISIBLE_LOG_LEVELS,
  type VisibleLogLevel,
} from "./logFilters";
import "./logs.css";

export interface LogsPageProps {
  logs: LogEntry[];
  onExportDiagnostics: () => void;
}

const toneForLevel = (level: VisibleLogLevel): StatusBadgeTone =>
  level === "warning" ? "warning" : level === "error" ? "error" : level === "info" ? "info" : "bug";

export default function LogsPage({ logs, onExportDiagnostics }: LogsPageProps) {
  const [selectedLevels, setSelectedLevels] = useState<VisibleLogLevel[]>([...VISIBLE_LOG_LEVELS]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const filteredLogs = useMemo(
    () => filterLogs(logs, { levels: selectedLevels, query }),
    [logs, query, selectedLevels],
  );
  const selectedEntry = logs.find((entry) => entry.id === selectedId) ?? null;
  const hasActiveSearch = query.trim().length > 0;
  const filterContext = `已选 ${selectedLevels.length} 个级别${hasActiveSearch ? `，搜索：${query}` : ""}`;

  return (
    <TableLayout
      toolbar={
        <LogFilterBar
          selectedLevels={selectedLevels}
          query={query}
          totalCount={logs.length}
          visibleCount={filteredLogs.length}
          onLevelsChange={setSelectedLevels}
          onQueryChange={setQuery}
          onExportDiagnostics={onExportDiagnostics}
        />
      }
      detailLabel="日志详情"
      detail={
        selectedEntry ? (
          <LogDetailDrawer entry={selectedEntry} onClose={() => setSelectedId(null)} />
        ) : null
      }
    >
      {filteredLogs.length === 0 ? (
        <EmptyState
          title={logs.length === 0 ? "暂无日志" : "暂无匹配日志"}
          reason={
            logs.length === 0
              ? "运行状态、协议错误和审计事件会显示在这里。"
              : "切换级别筛选或清空搜索词查看对应记录。"
          }
          context={filterContext}
          action={
            hasActiveSearch ? (
              <button type="button" className="ghost-btn" onClick={() => setQuery("")}>
                清除搜索
              </button>
            ) : null
          }
          icon={Logs}
          density="fill"
        />
      ) : (
        <div className="logs-table-region">
          <table className="logs-table">
            <thead>
              <tr>
                <th>级别</th>
                <th>时间</th>
                <th>模块</th>
                <th>消息</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    <StatusBadge
                      label={toVisibleLevel(entry.level)}
                      tone={toneForLevel(toVisibleLevel(entry.level))}
                    />
                  </td>
                  <td>{new Date(entry.timestampMs).toLocaleString("zh-CN")}</td>
                  <td>{entry.scope}</td>
                  <td>
                    <button
                      type="button"
                      className="log-message-cell"
                      onClick={() => setSelectedId(entry.id)}
                    >
                      {entry.message}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </TableLayout>
  );
}

import type { LogEntry, LogLevel } from "../../softuiTypes";

export type VisibleLogLevel = "warning" | "error" | "info" | "bug";

export const VISIBLE_LOG_LEVELS: VisibleLogLevel[] = ["warning", "error", "info", "bug"];

export interface LogFilterCriteria {
  levels: VisibleLogLevel[];
  query: string;
}

export const toVisibleLevel = (level: LogLevel): VisibleLogLevel =>
  level === "warn" ? "warning" : level === "debug" ? "bug" : level;

export function filterLogs(logs: LogEntry[], criteria: LogFilterCriteria): LogEntry[] {
  const query = criteria.query.trim().toLowerCase();
  return logs.filter((entry) => {
    if (criteria.levels.length > 0 && !criteria.levels.includes(toVisibleLevel(entry.level))) {
      return false;
    }
    if (!query) return true;
    return [entry.message, entry.scope, entry.deviceId ?? "", entry.frameHex ?? ""].some((value) =>
      value.toLowerCase().includes(query),
    );
  });
}

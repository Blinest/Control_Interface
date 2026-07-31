import { describe, expect, it } from "vitest";
import type { LogEntry } from "../../softuiTypes";
import { filterLogs, toVisibleLevel } from "./logFilters";

describe("log filters", () => {
  it("maps warn and debug to user-facing names", () => {
    expect(toVisibleLevel("warn")).toBe("warning");
    expect(toVisibleLevel("debug")).toBe("bug");
    expect(toVisibleLevel("error")).toBe("error");
  });

  it("filters debug entries with the bug filter", () => {
    const logs = [
      { id: 1, level: "debug", scope: "stream", message: "frame", timestampMs: 1 },
    ] as LogEntry[];

    expect(filterLogs(logs, { levels: ["bug"], query: "" })).toHaveLength(1);
    expect(filterLogs(logs, { levels: ["info"], query: "" })).toHaveLength(0);
  });

  it("matches query across message and scope without mutating input", () => {
    const logs = [
      { id: 1, level: "info", scope: "device", message: "serial opened", timestampMs: 1 },
      { id: 2, level: "info", scope: "boot", message: "startup complete", timestampMs: 2 },
    ] as LogEntry[];
    const original = [...logs];

    const result = filterLogs(logs, { levels: ["info"], query: "SERIAL" });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
    expect(logs).toEqual(original);
  });
});

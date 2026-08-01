import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LogEntry } from "../../softuiTypes";
import LogsPage from "./LogsPage";

const fixtureLogs: LogEntry[] = [
  { id: 1, level: "error", scope: "device", message: "串口写入失败", timestampMs: 1, deviceId: "softui-sim-01" },
  { id: 2, level: "warn", scope: "stream", message: "帧校验警告", timestampMs: 2, frameHex: "BB 02 10" },
  { id: 3, level: "info", scope: "boot", message: "启动完成", timestampMs: 3 },
  { id: 4, level: "debug", scope: "audit", message: "调试详情", timestampMs: 4 },
];

describe("LogsPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows exactly four user-facing level filters", () => {
    render(<LogsPage logs={fixtureLogs} onExportDiagnostics={vi.fn()} />);

    for (const level of ["warning", "error", "info", "bug"]) {
      expect(screen.getByRole("checkbox", { name: level })).toBeVisible();
    }
  });

  it("opens the full message in a detail drawer", async () => {
    const user = userEvent.setup();
    render(<LogsPage logs={fixtureLogs} onExportDiagnostics={vi.fn()} />);

    await user.click(screen.getByText(fixtureLogs[0].message));

    expect(screen.getByRole("complementary", { name: "日志详情" })).toBeVisible();
  });

  it("clears an active search from the empty result state", async () => {
    const user = userEvent.setup();
    render(<LogsPage logs={fixtureLogs} onExportDiagnostics={vi.fn()} />);

    await user.type(screen.getByRole("textbox"), "not-present");

    await user.click(screen.getByRole("button", { name: "清除搜索" }));

    expect(screen.getByRole("button", { name: fixtureLogs[0].message })).toBeVisible();
  });
});

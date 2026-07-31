import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureSnapshot } from "../../test/fixtures/fixtureSnapshot";
import type { SessionInfo } from "../../softuiTypes";
import SessionsPage from "./SessionsPage";

const sessionCallbacks = {
  onToggleRecording: vi.fn(),
  onPauseRecording: vi.fn(),
  onResumeRecording: vi.fn(),
  onDeleteSession: vi.fn(),
  onRenameSession: vi.fn(),
  onExportCsv: vi.fn(),
  onLoadPlayback: vi.fn(),
};

const fixtureSession: SessionInfo = {
  id: "session-1",
  name: "弯曲测试 1",
  startTime: "2026-07-29T10:00:00Z",
  endTime: "2026-07-29T10:00:01Z",
  deviceId: "softui-sim-01",
  frameCount: 100,
  fileSize: 4096,
  filePath: "D:\\APP\\ControlUI\\sessions\\session-1",
};

describe("SessionsPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("fills the empty history area with context and action", () => {
    render(
      <SessionsPage
        snapshot={fixtureSnapshot}
        sessions={[]}
        recorderStatus={{ active: false, sessionId: "", sessionName: "", frameCount: 0, elapsedSecs: 0, paused: false }}
        {...sessionCallbacks}
      />,
    );

    expect(screen.getByRole("heading", { name: "暂无录制会话" })).toBeVisible();
    expect(screen.getByText(/保存目录/)).toBeVisible();
    expect(screen.getByRole("button", { name: "开始录制" })).toBeVisible();
  });

  it("confirms before deleting a session", async () => {
    const user = userEvent.setup();
    render(
      <SessionsPage
        snapshot={fixtureSnapshot}
        sessions={[fixtureSession]}
        recorderStatus={{ active: false, sessionId: "", sessionName: "", frameCount: 0, elapsedSecs: 0, paused: false }}
        {...sessionCallbacks}
      />,
    );

    await user.click(screen.getByRole("button", { name: `删除 ${fixtureSession.name}` }));
    expect(screen.getByRole("alertdialog", { name: "确认删除会话" })).toBeVisible();
    expect(sessionCallbacks.onDeleteSession).not.toHaveBeenCalled();
  });
});

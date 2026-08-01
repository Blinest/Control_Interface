import { useEffect } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PageLayout } from "../../softuiTypes";
import { fixtureSnapshot } from "../../test/fixtures/fixtureSnapshot";
import {
  DeviceWorkspacePage,
  type DeviceWorkspacePageProps,
} from "./DeviceWorkspacePage";

const robotSceneLifecycle = vi.hoisted(() => ({ mounts: 0, unmounts: 0 }));

vi.mock("../../RobotScene", () => ({
  default: () => {
    useEffect(() => {
      robotSceneLifecycle.mounts += 1;
      return () => {
        robotSceneLifecycle.unmounts += 1;
      };
    }, []);
    return <div aria-label="三维模型视图" />;
  },
}));

const workspaceProps: DeviceWorkspacePageProps = {
  snapshot: fixtureSnapshot,
  currentDeviceId: "softui-sim-01",
  connectedDevices: [],
  deviceStatuses: {},
  recorderStatus: { active: false, sessionId: "", sessionName: "", frameCount: 0, elapsedSecs: 0, paused: false },
  sessions: [],
  playbackStatus: null,
  onSelectDevice: vi.fn(),
  onOpenConnectDialog: vi.fn(),
  onDisconnectDevice: vi.fn(),
  onRefreshSerialPorts: vi.fn(),
  onSystemControl: vi.fn(),
  onSendMotor: vi.fn(),
  onWorkspaceCommand: vi.fn(),
};

describe("DeviceWorkspacePage", () => {
  beforeEach(() => {
    localStorage.clear();
    robotSceneLifecycle.mounts = 0;
    robotSceneLifecycle.unmounts = 0;
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("separates manual and automatic control", async () => {
    render(<DeviceWorkspacePage {...workspaceProps} />);
    await userEvent.click(screen.getByRole("tab", { name: "手动控制" }));
    expect(screen.getByRole("heading", { name: "电机与弯曲控制" })).toBeVisible();
    expect(screen.queryByText("循环寿命控制")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("tab", { name: "自动控制" }));
    expect(screen.getByText("循环寿命控制")).toBeVisible();
  });

  it("mounts only the selected one of the five workspace panes", async () => {
    const user = userEvent.setup();
    render(<DeviceWorkspacePage {...workspaceProps} />);

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "监控",
      "实时数据",
      "手动控制",
      "自动控制",
      "回放",
    ]);
    expect(screen.getByRole("tabpanel", { name: "监控" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "电机与弯曲控制" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "实时数据" }));
    expect(screen.getByRole("tabpanel", { name: "实时数据" })).toBeVisible();
    expect(screen.queryByRole("tabpanel", { name: "监控" })).not.toBeInTheDocument();
  });

  it("includes the current device in manual and automatic command requests", async () => {
    const user = userEvent.setup();
    render(<DeviceWorkspacePage {...workspaceProps} />);

    await user.click(screen.getByRole("tab", { name: "手动控制" }));
    await user.click(screen.getByRole("button", { name: "发送电机命令" }));
    expect(workspaceProps.onSendMotor).toHaveBeenCalledWith(expect.objectContaining({
      deviceId: "softui-sim-01",
      motorId: 1,
    }));

    await user.click(screen.getByRole("tab", { name: "自动控制" }));
    await user.click(screen.getByRole("button", { name: "启动主动控制" }));
    await user.click(screen.getByRole("button", { name: "启动循环控制" }));
    expect(workspaceProps.onWorkspaceCommand).toHaveBeenCalledWith(
      "activeTick",
      expect.objectContaining({ deviceId: "softui-sim-01" }),
    );
    expect(workspaceProps.onWorkspaceCommand).toHaveBeenCalledWith(
      "startCycle",
      expect.objectContaining({ deviceId: "softui-sim-01" }),
    );
  });

  it("keeps the model scene mounted when a monitor card size is resized directly", () => {
    render(<DeviceWorkspacePage {...workspaceProps} />);

    expect(screen.getByLabelText("三维模型视图")).toBeVisible();
    expect(screen.queryByRole("button", { name: /\u8c03\u6574\u5e03\u5c40|\u7f16\u8f91\u5e03\u5c40|\u4fdd\u5b58\u5e03\u5c40|\u53d6\u6d88/ })).not.toBeInTheDocument();

    const resizeHandle = screen.getByRole("button", { name: "\u62c9\u4f38\u4e09\u7ef4\u6a21\u578b\u5361\u7247" });
    fireEvent.pointerDown(resizeHandle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(resizeHandle, { clientX: 40, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(resizeHandle, { pointerId: 1 });

    const saved = JSON.parse(
      localStorage.getItem(`softui:layout:${fixtureSnapshot.authSession.username}:workspace-monitor`) ?? "null",
    ) as PageLayout;
    expect(saved.cards.find((card) => card.id === "model3d")?.size).toBe("2x1");
    expect(robotSceneLifecycle.mounts).toBe(1);
    expect(robotSceneLifecycle.unmounts).toBe(0);
  });

  it("keeps selected-device telemetry empty when only another device has frames", async () => {
    const user = userEvent.setup();
    const snapshot = structuredClone(fixtureSnapshot);
    snapshot.live.selectedDeviceId = "device-without-frames";
    snapshot.live.frames[0].sequence = 987_654;
    snapshot.live.frames[0].motors[0].positionMm = 4_321.25;
    snapshot.charts.channels[0].points = [9_876.5];
    snapshot.runtimeDiagnostics.pendingCommands = 7_654;

    render(
      <DeviceWorkspacePage
        {...workspaceProps}
        currentDeviceId="device-without-frames"
        snapshot={snapshot}
      />,
    );

    const context = screen.getByLabelText("设备上下文");
    expect(within(context).getByText("最近帧").parentElement).toHaveTextContent("无数据");
    expect(within(context).queryByText("7654")).not.toBeInTheDocument();
    expect(screen.queryByText("#987654")).not.toBeInTheDocument();
    expect(screen.queryByText(/9876\.50/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("三维模型视图")).not.toBeInTheDocument();
    expect(screen.getByText("当前设备没有实时图表数据")).toBeVisible();
    expect(screen.getByText("当前设备没有三维姿态数据")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "实时数据" }));
    expect(screen.queryByText("4321.25 mm")).not.toBeInTheDocument();
    expect(screen.getByText("当前设备没有电机数据")).toBeVisible();
    expect(screen.getByText("当前设备没有传感器数据")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "手动控制" }));
    expect(screen.queryByText("4321.3 mm")).not.toBeInTheDocument();
    expect(screen.getByText("当前设备没有电机状态数据")).toBeVisible();
  });

  it("resets manual control drafts when the current device changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DeviceWorkspacePage {...workspaceProps} />);

    await user.click(screen.getByRole("tab", { name: "手动控制" }));
    const position = screen.getByRole("spinbutton", { name: "目标位置 (mm)" });
    await user.clear(position);
    await user.type(position, "42.5");
    expect(position).toHaveValue(42.5);

    rerender(<DeviceWorkspacePage {...workspaceProps} currentDeviceId="device-b" />);

    expect(screen.getByRole("spinbutton", { name: "目标位置 (mm)" })).toHaveValue(0);
    await user.click(screen.getByRole("button", { name: "发送电机命令" }));
    expect(workspaceProps.onSendMotor).toHaveBeenLastCalledWith(expect.objectContaining({
      deviceId: "device-b",
      positionMm: 0,
    }));
  });

  it("resets automatic control drafts when the current device changes", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DeviceWorkspacePage {...workspaceProps} />);

    await user.click(screen.getByRole("tab", { name: "自动控制" }));
    const kp = screen.getByRole("spinbutton", { name: "Kp" });
    await user.clear(kp);
    await user.type(kp, "77");
    expect(kp).toHaveValue(77);

    rerender(<DeviceWorkspacePage {...workspaceProps} currentDeviceId="device-b" />);

    expect(screen.getByRole("spinbutton", { name: "Kp" })).toHaveValue(
      fixtureSnapshot.controlRuntime.pid.kp,
    );
    await user.click(screen.getByRole("button", { name: "保存 PID 参数" }));
    expect(workspaceProps.onWorkspaceCommand).toHaveBeenLastCalledWith(
      "updatePid",
      expect.objectContaining({
        deviceId: "device-b",
        pid: expect.objectContaining({ kp: fixtureSnapshot.controlRuntime.pid.kp }),
      }),
    );
  });

  it("does not expose another device's active playback as current-device playback", async () => {
    const user = userEvent.setup();
    const sessions = [
      {
        id: "session-current",
        name: "Current device session",
        startTime: "2026-07-29T09:00:00+08:00",
        endTime: null,
        deviceId: "softui-sim-01",
        frameCount: 12,
        fileSize: 512,
        filePath: "current.jsonl",
      },
      {
        id: "session-foreign",
        name: "Foreign device session",
        startTime: "2026-07-29T10:00:00+08:00",
        endTime: null,
        deviceId: "device-b",
        frameCount: 24,
        fileSize: 1024,
        filePath: "foreign.jsonl",
      },
    ];
    const playbackStatus = {
      active: true,
      sessionId: "session-foreign",
      playing: true,
      speed: 1,
      cursorMs: 500,
      durationMs: 1_000,
      cursorPct: 0.5,
      totalFrames: 24,
      currentFrameIdx: 12,
    };
    render(
      <DeviceWorkspacePage
        {...workspaceProps}
        playbackStatus={playbackStatus}
        sessions={sessions}
      />,
    );

    await user.click(screen.getByRole("tab", { name: "回放" }));

    expect(screen.queryByTitle("停止")).not.toBeInTheDocument();
    expect(screen.getAllByText("另一设备正在回放").length).toBeGreaterThan(0);
    expect(screen.getByText("Current device session")).toBeVisible();
    expect(screen.queryByText("Foreign device session")).not.toBeInTheDocument();
  });
});

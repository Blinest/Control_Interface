import { useEffect } from "react";
import { cleanup, render, screen } from "@testing-library/react";
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

  it("keeps the model scene mounted when a monitor card size is saved", async () => {
    const user = userEvent.setup();
    render(<DeviceWorkspacePage {...workspaceProps} />);

    expect(screen.getByLabelText("三维模型视图")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "编辑布局" }));
    await user.click(screen.getByRole("button", { name: "调整三维模型卡片大小" }));
    await user.click(screen.getByRole("button", { name: "宽 2×1" }));
    await user.click(screen.getByRole("button", { name: "保存布局" }));

    const saved = JSON.parse(
      localStorage.getItem(`softui:layout:${fixtureSnapshot.authSession.username}:workspace-monitor`) ?? "null",
    ) as PageLayout;
    expect(saved.cards.find((card) => card.id === "model3d")?.size).toBe("2x1");
    expect(robotSceneLifecycle.mounts).toBe(1);
    expect(robotSceneLifecycle.unmounts).toBe(0);
  });
});

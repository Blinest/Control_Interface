import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fixtureSnapshot } from "../../test/fixtures/fixtureSnapshot";
import type { PageLayout } from "../../softuiTypes";
import { DashboardPage, type DashboardPageProps } from "./DashboardPage";

const dashboardProps: DashboardPageProps = {
  snapshot: fixtureSnapshot,
  connectedDevices: [],
  deviceStatuses: {},
  recorderStatus: {
    active: false,
    sessionId: "",
    sessionName: "",
    frameCount: 0,
    elapsedSecs: 0,
    paused: false,
  },
  sessions: [],
};

describe("DashboardPage", () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it("keeps control-critical status outside the configurable card grid", () => {
    const sparseLayout: PageLayout = {
      schemaVersion: 1,
      cards: [
        { id: "connection", size: "1x1", visible: true },
        { id: "sampling", size: "1x1", visible: false },
        { id: "recording", size: "1x1", visible: false },
        { id: "alerts", size: "1x1", visible: false },
        { id: "deviceHealth", size: "2x1", visible: false },
        { id: "recentSessions", size: "2x1", visible: false },
        { id: "recentEvents", size: "2x1", visible: false },
      ],
    };
    localStorage.setItem(
      `softui:layout:${fixtureSnapshot.authSession.username}:dashboard`,
      JSON.stringify(sparseLayout),
    );

    const snapshot = structuredClone(fixtureSnapshot);
    snapshot.runtimeDiagnostics.lastError = "E-GLOBAL-451: safety interlock unavailable";

    render(<DashboardPage {...dashboardProps} snapshot={snapshot} />);

    const summary = screen.getByLabelText("全局设备摘要");
    expect(within(summary).getByText("当前控制设备")).toBeVisible();
    expect(within(summary).getByText("连接状态")).toBeVisible();
    expect(within(summary).getByText("使能状态")).toBeVisible();
    expect(within(summary).getByText("急停状态")).toBeVisible();
    expect(within(summary).getByText("全局故障")).toBeVisible();
    expect(within(summary).getByText("E-GLOBAL-451: safety interlock unavailable")).toBeVisible();
    expect(screen.queryByRole("heading", { name: "最近关键事件" })).not.toBeInTheDocument();
  });

  it("does not use another device's frame as the selected device summary", () => {
    const snapshot = structuredClone(fixtureSnapshot);
    snapshot.live.selectedDeviceId = "device-without-frames";
    snapshot.live.frames[0].quality.latencyMs = 43_210;
    snapshot.live.frames[0].systemEnabled = true;

    render(<DashboardPage {...dashboardProps} snapshot={snapshot} />);

    const summary = screen.getByLabelText("全局设备摘要");
    expect(within(summary).getByText("使能状态").parentElement).toHaveTextContent("无数据");

    const healthCard = screen.getByRole("heading", { name: "设备健康" }).closest("article");
    expect(healthCard).not.toBeNull();
    expect(within(healthCard as HTMLElement).queryByText("43210 ms")).not.toBeInTheDocument();
    expect(within(healthCard as HTMLElement).getAllByText("无数据").length).toBeGreaterThan(0);
  });

  it("edits and persists the current user's dashboard layout", async () => {
    const user = userEvent.setup();
    render(<DashboardPage {...dashboardProps} />);

    await user.click(screen.getByRole("button", { name: "编辑布局" }));
    await user.click(screen.getByRole("button", { name: "调整连接状态卡片大小" }));
    await user.click(screen.getByRole("button", { name: "宽 2×1" }));
    await user.click(screen.getByRole("button", { name: "保存布局" }));

    const saved = JSON.parse(
      localStorage.getItem(`softui:layout:${fixtureSnapshot.authSession.username}:dashboard`) ?? "null",
    ) as PageLayout;
    expect(saved.cards.find((card) => card.id === "connection")?.size).toBe("2x1");
    expect(screen.queryByLabelText("编辑卡片布局")).not.toBeInTheDocument();
  });
});

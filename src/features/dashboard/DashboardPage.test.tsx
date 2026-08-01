import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
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

  it("persists dashboard card resizing immediately without layout edit text buttons", () => {
    render(<DashboardPage {...dashboardProps} />);

    expect(screen.queryByRole("button", { name: /\u8c03\u6574\u5e03\u5c40|\u7f16\u8f91\u5e03\u5c40|\u4fdd\u5b58\u5e03\u5c40|\u53d6\u6d88/ })).not.toBeInTheDocument();

    const resizeHandle = screen.getByRole("button", { name: "\u62c9\u4f38\u8fde\u63a5\u72b6\u6001\u5361\u7247" });
    fireEvent.pointerDown(resizeHandle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(resizeHandle, { clientX: 40, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(resizeHandle, { pointerId: 1 });

    const saved = JSON.parse(
      localStorage.getItem(`softui:layout:${fixtureSnapshot.authSession.username}:dashboard`) ?? "null",
    ) as PageLayout;
    expect(saved.cards.find((card) => card.id === "connection")?.size).toBe("2x1");
  });
});

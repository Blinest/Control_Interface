import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RuntimeSnapshot } from "../../softuiTypes";
import { fixtureSnapshot } from "../../test/fixtures/fixtureSnapshot";
import ChartsPage from "./ChartsPage";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

interface UPlotMockAxis {
  grid?: { stroke?: string };
  label?: string;
  size?: number;
}

interface UPlotMockSeries {
  label?: string;
}

interface UPlotMockInstance {
  over: {
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    getBoundingClientRect: () => { left: number; width: number };
  };
  scales: { x: { min: number; max: number } };
  cursor: { idx: number | null };
  data: unknown[];
  options: {
    axes: UPlotMockAxis[];
    hooks?: { setCursor?: Array<(plot: UPlotMockInstance) => void> };
    series: UPlotMockSeries[];
  };
  setScale: ReturnType<typeof vi.fn>;
  syncRect: ReturnType<typeof vi.fn>;
  posToVal: ReturnType<typeof vi.fn>;
}

const uplotMockState = vi.hoisted(() => ({
  instances: [] as UPlotMockInstance[],
}));

vi.mock("uplot", () => ({
  default: class UPlotMock {
    over = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: () => ({ left: 0, width: 320 }),
    };
    scales = { x: { min: -4.75, max: 0 } };
    cursor = { idx: null };
    data: unknown[] = [];
    options: {
      axes: UPlotMockAxis[];
      hooks?: { setCursor?: Array<(plot: UPlotMockInstance) => void> };
      series: UPlotMockSeries[];
    };
    setScale = vi.fn((scaleName: string, next: { min: number; max: number }) => {
      if (scaleName === "x") {
        this.scales.x = next;
      }
    });
    syncRect = vi.fn();
    posToVal = vi.fn(() => -2);

    constructor(
      options: {
        axes: UPlotMockAxis[];
        hooks?: { setCursor?: Array<(plot: UPlotMockInstance) => void> };
        series: UPlotMockSeries[];
      },
      data: unknown[],
    ) {
      this.options = options;
      this.data = data;
      uplotMockState.instances.push(this);
    }

    destroy() {}
    setData() {}
    setSize() {}
  },
}));

describe("ChartsPage", () => {
  afterEach(() => {
    cleanup();
    uplotMockState.instances = [];
    vi.unstubAllGlobals();
  });

  it("keeps channel controls separate from the chart canvas", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    render(<ChartsPage snapshot={fixtureSnapshot} currentDeviceId="softui-sim-01" />);

    expect(screen.getByRole("complementary", { name: "曲线通道" })).toBeVisible();
    expect(screen.getByRole("region", { name: "子图 1 曲线 Motor 1" })).toBeVisible();
    expect(screen.getByRole("button", { name: "重置缩放" })).toBeVisible();
  });

  it("renders six independently assignable subplots instead of one combined plot", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    render(<ChartsPage snapshot={fixtureSnapshot} currentDeviceId="softui-sim-01" />);

    const subplots = screen.getAllByRole("region", { name: /子图 \d 曲线/ });
    expect(subplots).toHaveLength(6);
    expect(screen.queryByRole("region", { name: "曲线绘图区" })).not.toBeInTheDocument();

    const assignmentControls = screen.getAllByRole("combobox", { name: /子图 \d 曲线/ });
    expect(assignmentControls).toHaveLength(6);
    expect(assignmentControls[0]).toHaveValue("channel:Motor 1");

    await userEvent.selectOptions(assignmentControls[0], "channel:Motor 2");

    expect(assignmentControls[0]).toHaveValue("channel:Motor 2");
    expect(subplots[0]).toHaveAccessibleName("子图 1 曲线 Motor 2");
  });
  it("zooms only the subplot under the wheel cursor", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    render(<ChartsPage snapshot={fixtureSnapshot} currentDeviceId="softui-sim-01" />);

    expect(uplotMockState.instances).toHaveLength(6);
    const firstWheelHandler = uplotMockState.instances[0].over.addEventListener.mock.calls.find(
      (call) => call[0] === "wheel",
    )?.[1] as ((event: WheelEvent) => void) | undefined;
    expect(firstWheelHandler).toBeDefined();

    firstWheelHandler?.({
      clientX: 160,
      deltaY: -120,
      preventDefault: vi.fn(),
    } as unknown as WheelEvent);

    expect(uplotMockState.instances[0].setScale).toHaveBeenCalledTimes(1);
    for (const plot of uplotMockState.instances.slice(1)) {
      expect(plot.setScale).not.toHaveBeenCalled();
    }
  });

  it("shows the channel list as a read-only library instead of visibility toggles", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    render(<ChartsPage snapshot={fixtureSnapshot} currentDeviceId="softui-sim-01" />);

    const channelRail = screen.getByRole("complementary", { name: "曲线通道" });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(channelRail).getAllByText("Motor 1").some((node) => node.tagName === "SPAN")).toBe(true);
  });

  it("plots all parameters for one motor in the same subplot", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    render(<ChartsPage snapshot={makeMotorParameterSnapshot()} currentDeviceId="softui-sim-01" />);

    const firstAssignment = screen.getAllByRole("combobox", { name: /子图 \d 曲线/ })[0];
    await userEvent.selectOptions(firstAssignment, "motor:1:all");

    expect(firstAssignment).toHaveValue("motor:1:all");
    const firstRecreatedPlot = uplotMockState.instances[uplotMockState.instances.length - 6];
    expect(firstRecreatedPlot?.options.series.slice(1).map((series: UPlotMockSeries) => series.label)).toEqual([
      "Motor 1 pos",
      "Motor 1 vel",
      "Motor 1 acc",
    ]);
  });

  it("creates one compact y axis per unit when one subplot contains mixed motor parameters", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    render(<ChartsPage snapshot={makeMotorParameterSnapshot()} currentDeviceId="softui-sim-01" />);

    const firstAssignment = screen.getAllByRole("combobox", { name: /子图 \d 曲线/ })[0];
    await userEvent.selectOptions(firstAssignment, "motor:1:all");

    const firstRecreatedPlot = uplotMockState.instances[uplotMockState.instances.length - 6];
    const yAxes = firstRecreatedPlot?.options.axes.slice(1);
    expect(yAxes?.map((axis: UPlotMockAxis) => axis.label)).toEqual(["mm", "mm/s", "mm/s²"]);
    expect(yAxes?.map((axis: UPlotMockAxis) => axis.size)).toEqual([44, 44, 44]);
    expect(yAxes?.map((axis: UPlotMockAxis) => axis.grid?.stroke)).toEqual([
      "rgba(255,255,255,0.06)",
      "rgba(255,255,255,0)",
      "rgba(255,255,255,0)",
    ]);
  });

  it("plots the same parameter from all motors in the same subplot", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    render(<ChartsPage snapshot={makeMotorParameterSnapshot()} currentDeviceId="softui-sim-01" />);

    const firstAssignment = screen.getAllByRole("combobox", { name: /子图 \d 曲线/ })[0];
    await userEvent.selectOptions(firstAssignment, "motor-param:vel");

    expect(firstAssignment).toHaveValue("motor-param:vel");
    const firstRecreatedPlot = uplotMockState.instances[uplotMockState.instances.length - 6];
    expect(firstRecreatedPlot?.options.series.slice(1).map((series: UPlotMockSeries) => series.label)).toEqual([
      "Motor 1 vel",
      "Motor 2 vel",
    ]);
  });

  it("filters the channel library without removing subplot assignment controls", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    render(<ChartsPage snapshot={makeMotorParameterSnapshot()} currentDeviceId="softui-sim-01" />);

    await userEvent.type(screen.getByRole("searchbox", { name: "过滤通道" }), "Motor 2 vel");

    expect(screen.getByRole("combobox", { name: "子图 1 曲线" })).toBeVisible();
    const channelNames = Array.from(document.querySelectorAll(".channel-item .channel-name")).map((node) => node.textContent);
    expect(channelNames).toEqual(["Motor 2 vel"]);
  });

  it("marks channel rows that are already assigned to a subplot", () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    render(<ChartsPage snapshot={makeMotorParameterSnapshot()} currentDeviceId="softui-sim-01" />);

    expect(screen.getAllByText("Motor 1 pos").find((node) => node.closest(".channel-item"))?.closest(".channel-item"))
      .toHaveAttribute("data-assigned-subplots", "1");
  });

  it("keeps the active subplot cursor readout when inactive subplot cursors are null", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);

    render(<ChartsPage snapshot={fixtureSnapshot} currentDeviceId="softui-sim-01" />);

    const activePlot = uplotMockState.instances[0];
    activePlot.cursor.idx = 1;
    activePlot.options.hooks?.setCursor?.[0]?.(activePlot);
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    expect(screen.getByText(/#2/)).toBeVisible();
    expect(document.querySelector(".charts-readout .charts-readout-name")?.textContent).toBe("Motor 1");

    const inactivePlot = uplotMockState.instances[5];
    inactivePlot.cursor.idx = null;
    inactivePlot.options.hooks?.setCursor?.[0]?.(inactivePlot);
    await new Promise((resolve) => window.requestAnimationFrame(resolve));

    expect(screen.getByText(/#2/)).toBeVisible();
    expect(document.querySelector(".charts-readout .charts-readout-name")?.textContent).toBe("Motor 1");
  });
});

function makeMotorParameterSnapshot(): RuntimeSnapshot {
  const motorChannels = [1, 2].flatMap((motorId) => (
    ["pos", "vel", "acc"].map((parameter, parameterIndex) => ({
      name: `Motor ${motorId} ${parameter}`,
      unit: parameter === "pos" ? "mm" : parameter === "vel" ? "mm/s" : "mm/s²",
      channelType: "motor",
      channelIndex: motorId,
      points: [1, 2, 3].map((value) => value + motorId * 10 + parameterIndex),
    }))
  ));

  return {
    ...fixtureSnapshot,
    charts: {
      windowSize: 3,
      channels: motorChannels,
    },
  };
}

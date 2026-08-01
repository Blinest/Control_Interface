import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureSnapshot } from "../../test/fixtures/fixtureSnapshot";
import ChartsPage from "./ChartsPage";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

vi.mock("uplot", () => ({
  default: class UPlotMock {
    over = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      getBoundingClientRect: () => ({ left: 0, width: 320 }),
    };
    scales = { x: { min: -4.75, max: 0 } };
    data: unknown[] = [];

    constructor(_options: unknown, data: unknown[]) {
      this.data = data;
    }

    destroy() {}
    setData() {}
    setSize() {}
    setScale() {}
    syncRect() {}
    posToVal() {
      return 0;
    }
  },
}));

describe("ChartsPage", () => {
  afterEach(() => {
    cleanup();
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
    expect(assignmentControls[0]).toHaveValue("Motor 1");

    await userEvent.selectOptions(assignmentControls[0], "Motor 2");

    expect(assignmentControls[0]).toHaveValue("Motor 2");
    expect(subplots[0]).toHaveAccessibleName("子图 1 曲线 Motor 2");
  });
});

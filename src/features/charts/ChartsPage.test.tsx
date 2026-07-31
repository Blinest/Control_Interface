import { cleanup, render, screen } from "@testing-library/react";
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
    expect(screen.getByRole("region", { name: "曲线绘图区" })).toBeVisible();
    expect(screen.getByRole("button", { name: "重置缩放" })).toBeVisible();
  });
});

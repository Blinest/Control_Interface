import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ChartLayout } from "../../layouts/ChartLayout";

describe("responsive layout rails", () => {
  afterEach(() => cleanup());

  it("keeps chart channels reachable through a labelled rail", () => {
    render(
      <ChartLayout
        channels={<button>Channel A</button>}
        toolbar={<button>Refresh</button>}
        channelsLabel="Chart channels"
      >
        <div>plot</div>
      </ChartLayout>,
    );

    const rail = screen.getByRole("complementary", { name: "Chart channels" });

    expect(rail.querySelector(".responsive-rail-scroll")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Channel A" })).toBeInTheDocument();
  });

  it("collapses and expands the chart rail from the left edge", () => {
    render(
      <ChartLayout
        channels={<button>Channel A</button>}
        toolbar={<button>Refresh</button>}
        channelsLabel="Chart channels"
      >
        <div>plot</div>
      </ChartLayout>,
    );

    const rail = screen.getByRole("complementary", { name: "Chart channels" });
    fireEvent.click(screen.getByRole("button", { name: "收起Chart channels" }));

    expect(rail).toHaveClass("is-collapsed");
    expect(screen.getByRole("button", { name: "展开Chart channels" })).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "展开Chart channels" }));

    expect(rail).not.toHaveClass("is-collapsed");
  });
});

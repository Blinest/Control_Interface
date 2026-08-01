import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartLayout } from "../../layouts/ChartLayout";

describe("responsive layout rails", () => {
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
});

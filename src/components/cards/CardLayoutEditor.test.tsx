import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultDashboardLayout } from "../../state/layoutStore";
import { DirectCardLayout } from "./CardLayoutEditor";

describe("DirectCardLayout", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("updates the layout when a card is resized", () => {
    const onLayoutChange = vi.fn();

    render(
      <DirectCardLayout
        layout={defaultDashboardLayout}
        onLayoutChange={onLayoutChange}
        childrenForCard={(card) => <h2>{card.id}</h2>}
      />,
    );

    const handle = screen.getByRole("button", { name: "\u62c9\u4f38\u8fde\u63a5\u72b6\u6001\u5361\u7247" });
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 40, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(onLayoutChange).toHaveBeenCalledWith(expect.objectContaining({
      cards: expect.arrayContaining([expect.objectContaining({ id: "connection", size: "2x2" })]),
    }));
  });

  it("exposes labelled icon-only direct manipulation controls", () => {
    render(
      <DirectCardLayout
        layout={defaultDashboardLayout}
        onLayoutChange={vi.fn()}
        childrenForCard={(card) => <h2>{card.id}</h2>}
      />,
    );

    expect(screen.getByRole("button", { name: "\u79fb\u52a8\u8fde\u63a5\u72b6\u6001\u5361\u7247" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "\u62c9\u4f38\u8fde\u63a5\u72b6\u6001\u5361\u7247" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "\u4fdd\u5b58\u5e03\u5c40" })).not.toBeInTheDocument();
  });

  it("reorders cards with the focused keyboard drag handle", async () => {
    const onLayoutChange = vi.fn();
    const user = userEvent.setup();
    const rect = (left: number): DOMRect => ({
      bottom: 132,
      height: 132,
      left,
      right: left + 120,
      toJSON: () => ({}),
      top: 0,
      width: 120,
      x: left,
      y: 0,
    });

    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const card = this.closest(".card-layout-item");
      const index = card?.parentElement ? Array.from(card.parentElement.children).indexOf(card) : 0;
      return rect(index * 132);
    });

    render(
      <DirectCardLayout
        layout={defaultDashboardLayout}
        onLayoutChange={onLayoutChange}
        childrenForCard={(card) => <h2>{card.id}</h2>}
      />,
    );

    screen.getAllByRole("button", { name: /\u79fb\u52a8.*\u5361\u7247/ })[0].focus();
    await user.keyboard("[Space]");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await user.keyboard("[ArrowRight][Space]");

    expect(onLayoutChange.mock.calls[0][0].cards.slice(0, 2).map((card: { id: string }) => card.id)).toEqual([
      "sampling",
      "connection",
    ]);
  });
});

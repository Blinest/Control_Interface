import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardLayoutEditor } from "./CardLayoutEditor";
import { SortableCard } from "./SortableCard";
import { defaultDashboardLayout } from "../../state/layoutStore";

describe("CardLayoutEditor", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("resizes a card by dragging its resize handle", async () => {
    const save = vi.fn();
    const user = userEvent.setup();

    render(
      <CardLayoutEditor
        layout={defaultDashboardLayout}
        onSave={save}
        onCancel={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    const handle = screen.getByRole("button", { name: "调整连接状态卡片大小" });
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 40, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });
    await user.click(screen.getByRole("button", { name: "保存布局" }));

    expect(save.mock.calls[0][0].cards.find((card: { id: string }) => card.id === "connection").size).toBe("2x2");
  });

  it("uses a drag handle instead of a size menu", () => {
    render(
      <CardLayoutEditor
        layout={defaultDashboardLayout}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "调整连接状态卡片大小" })).toBeVisible();
    expect(screen.queryByRole("list", { name: "连接状态卡片尺寸" })).not.toBeInTheDocument();
  });

  it("reorders cards with the focused keyboard drag handle", async () => {
    const save = vi.fn();
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
      const card = this.closest(".card-layout-card");
      const index = card?.parentElement ? Array.from(card.parentElement.children).indexOf(card) : 0;
      return rect(index * 132);
    });

    render(
      <CardLayoutEditor
        layout={defaultDashboardLayout}
        onSave={save}
        onCancel={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    screen.getAllByRole("button", { name: "移动卡片" })[0].focus();
    await user.keyboard("[Space]");
    await new Promise((resolve) => setTimeout(resolve, 20));
    await user.keyboard("[ArrowRight][Space]");
    await user.click(screen.getByRole("button", { name: "保存布局" }));

    expect(save.mock.calls[0][0].cards.slice(0, 2).map((card: { id: string }) => card.id)).toEqual([
      "sampling",
      "connection",
    ]);
  });

  it("does not render a drag handle in normal mode", () => {
    render(
      <SortableCard card={defaultDashboardLayout.cards[0]} className="card-layout-card">
        <span>连接状态</span>
      </SortableCard>,
    );

    expect(screen.queryByRole("button", { name: "移动卡片" })).not.toBeInTheDocument();
    expect(screen.getByRole("article")).not.toHaveAttribute("aria-roledescription");
  });
});

import { cleanup, render, screen, within } from "@testing-library/react";
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

  it("changes a card only to an allowed preset size", async () => {
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

    await user.click(screen.getByRole("button", { name: "调整连接状态卡片大小" }));
    await user.click(screen.getByRole("button", { name: "宽 2×1" }));
    await user.click(screen.getByRole("button", { name: "保存布局" }));

    expect(save.mock.calls[0][0].cards.find((card: { id: string }) => card.id === "connection").size).toBe("2x1");
  });

  it("offers exactly the four allowed preset sizes as native buttons", async () => {
    const user = userEvent.setup();

    render(
      <CardLayoutEditor
        layout={defaultDashboardLayout}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        onReset={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "调整连接状态卡片大小" }));

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    const sizeList = screen.getByRole("list", { name: "连接状态卡片尺寸" });

    expect(within(sizeList).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "小 1×1",
      "宽 2×1",
      "高 1×2",
      "大 2×2",
    ]);
    expect(within(sizeList).getByRole("button", { name: "小 1×1" })).toHaveAttribute("aria-pressed", "true");
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

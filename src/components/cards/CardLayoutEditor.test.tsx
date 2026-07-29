import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardLayoutEditor } from "./CardLayoutEditor";
import { defaultDashboardLayout } from "../../state/layoutStore";

describe("CardLayoutEditor", () => {
  afterEach(cleanup);

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
    await user.click(screen.getByRole("menuitem", { name: "宽 2×1" }));
    await user.click(screen.getByRole("button", { name: "保存布局" }));

    expect(save.mock.calls[0][0].cards.find((card: { id: string }) => card.id === "connection").size).toBe("2x1");
  });
});

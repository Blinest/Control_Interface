import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialog } from "./ConfirmDialog";

describe("ConfirmDialog", () => {
  afterEach(cleanup);

  it("requires explicit confirmation", async () => {
    const confirm = vi.fn();
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        open
        title="确认电机运动"
        details={["设备：serial:COM3"]}
        confirmLabel="确认发送"
        level="danger"
        onConfirm={confirm}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "确认发送" }));

    expect(confirm).toHaveBeenCalledOnce();
  });

  it("exposes an accessible alert dialog and focuses cancel for danger", () => {
    render(
      <ConfirmDialog
        open
        title="确认电机运动"
        details={["设备：serial:COM3"]}
        confirmLabel="确认发送"
        level="danger"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("alertdialog");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleName("确认电机运动");
    expect(dialog).toHaveAccessibleDescription("设备：serial:COM3");
    expect(screen.getByRole("button", { name: "取消" })).toHaveFocus();
  });

  it("focuses confirm for warning", () => {
    render(
      <ConfirmDialog
        open
        title="确认启用"
        details={["设备：serial:COM3"]}
        confirmLabel="确认启用"
        level="warning"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "确认启用" })).toHaveFocus();
  });
});

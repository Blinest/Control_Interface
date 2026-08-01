import { render, screen } from "@testing-library/react";
import { Database } from "lucide-react";
import { describe, expect, it } from "vitest";
import { EmptyState } from "./EmptyState";
import { PathValue } from "./PathValue";
import { StatusBadge } from "./StatusBadge";

describe("data components", () => {
  it("explains the empty state with context and a next action", () => {
    render(
      <EmptyState
        title="暂无录制会话"
        reason="尚未开始录制"
        context="设备：SIM-A"
        action={<button>开始录制</button>}
        icon={Database}
      />,
    );

    expect(screen.getByRole("heading", { name: "暂无录制会话" })).toBeVisible();
    expect(screen.getByText("尚未开始录制")).toBeVisible();
    expect(screen.getByText("设备：SIM-A")).toBeVisible();
    expect(screen.getByRole("button", { name: "开始录制" })).toBeVisible();
  });

  it("supports a fill density for empty primary regions", () => {
    const { container } = render(
      <EmptyState
        title="暂无录制会话"
        reason="尚未开始录制"
        context="保存目录：D:\\APP\\ControlUI\\data"
        density="fill"
        action={<button>开始录制</button>}
      />,
    );

    expect(container.querySelector(".data-empty-state")).toHaveClass("empty-state-fill");
  });

  it("keeps the full path available and supports compact mode", () => {
    const path = "D:\\APP\\ControlUI\\sessions\\very-long-name";
    const { rerender } = render(<PathValue value={path} />);

    expect(screen.getByTitle(path)).toBeVisible();

    rerender(<PathValue value={path} compact />);
    expect(screen.getByTitle(path)).toHaveClass("path-value-compact");
  });

  it("labels status with a visible badge tone", () => {
    render(<StatusBadge label="warning" tone="warning" />);

    const badge = screen.getByText("warning");
    expect(badge).toBeVisible();
    expect(badge.closest(".status-badge")).toHaveClass("status-badge-warning");
  });
});

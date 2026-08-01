import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardResizeHandle } from "./CardResizeHandle";

describe("direct card layout", () => {
  it("resizes by dragging the card handle", () => {
    const onResize = vi.fn();

    render(
      <CardResizeHandle
        label={"\u62c9\u4f38\u8fde\u63a5\u72b6\u6001\u5361\u7247"}
        onResize={onResize}
        size="1x1"
      />,
    );

    const handle = screen.getByRole("button", { name: "\u62c9\u4f38\u8fde\u63a5\u72b6\u6001\u5361\u7247" });
    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0, pointerId: 1 });
    fireEvent.pointerMove(handle, { clientX: 48, clientY: 48, pointerId: 1 });
    fireEvent.pointerUp(handle, { pointerId: 1 });

    expect(onResize).toHaveBeenCalledWith("2x2");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TableLayout } from "./TableLayout";
import { WorkbenchLayout } from "./WorkbenchLayout";

describe("page layouts", () => {
  it("keeps workbench context separate from the task area", () => {
    render(
      <WorkbenchLayout
        context={<div>设备上下文</div>}
        tabs={<div>标签</div>}
      >
        <div>任务区域</div>
      </WorkbenchLayout>,
    );

    expect(screen.getByText("设备上下文").closest("aside")).toBeTruthy();
    expect(screen.getByText("任务区域").closest("main")).toBeTruthy();
  });

  it("keeps table tools outside the scroll region", () => {
    render(
      <TableLayout toolbar={<div>筛选</div>}>
        <div>日志列表</div>
      </TableLayout>,
    );

    expect(screen.getByText("筛选")).toBeVisible();
    expect(screen.getByText("日志列表").parentElement).toHaveClass(
      "layout-scroll-region",
    );
  });
});

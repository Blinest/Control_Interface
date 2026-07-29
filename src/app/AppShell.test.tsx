import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell", () => {
  it("keeps current device and emergency stop visible", () => {
    render(
      <MemoryRouter>
        <AppShell
          currentDeviceLabel="STM32-A"
          connectionLabel="COM3 Ready"
          enabled={false}
          recording={false}
          emergencyLatched={false}
          footerItems={["采样 100 Hz", "命令队列 0"]}
          onEmergencyStop={vi.fn()}
        >
          <div>页面内容</div>
        </AppShell>
      </MemoryRouter>,
    );
    expect(screen.getByText("STM32-A")).toBeVisible();
    expect(screen.getByRole("button", { name: "紧急停止" })).toBeVisible();
    expect(screen.getByText("页面内容")).toBeVisible();
  });

  it("calls logout from the authenticated account control", () => {
    const onLogout = vi.fn();

    render(
      <MemoryRouter>
        <AppShell
          currentDeviceLabel="STM32-A"
          connectionLabel="COM3 Ready"
          currentUserLabel="operator"
          enabled={false}
          emergencyLatched={false}
          footerItems={[]}
          onEmergencyStop={vi.fn()}
          onLogout={onLogout}
          recording={false}
        >
          <div>页面内容</div>
        </AppShell>
      </MemoryRouter>,
    );

    screen.getByRole("button", { name: "退出 operator" }).click();

    expect(onLogout).toHaveBeenCalledOnce();
  });
});

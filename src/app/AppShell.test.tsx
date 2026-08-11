import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";

function renderShell(overrides: Partial<Parameters<typeof AppShell>[0]> = {}) {
  render(
    <MemoryRouter>
      <AppShell
        connectionLabel="ready"
        currentDeviceLabel="simulator:0"
        currentUserLabel="admin"
        emergencyLatched={false}
        enabled
        footerItems={["14 Hz"]}
        onEmergencyStop={vi.fn()}
        onLogout={vi.fn()}
        recording={false}
        {...overrides}
      >
        <div>Dashboard content</div>
      </AppShell>
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  afterEach(() => {
    cleanup();
  });

  it("collapses the primary sidebar toward the left edge", () => {
    renderShell();

    const shell = screen.getByTestId("app-shell");
    expect(shell).not.toHaveClass("is-sidebar-collapsed");

    fireEvent.click(screen.getByRole("button", { name: "收起主导航" }));

    expect(shell).toHaveClass("is-sidebar-collapsed");
    expect(screen.getByRole("button", { name: "展开主导航" })).toBeVisible();
  });

  it("assigns semantic classes to global status chips", () => {
    renderShell({ enabled: false });

    expect(screen.getByText("ready").closest(".status-chip")).toHaveClass("is-ok");
    expect(screen.getByText("未使能").closest(".status-chip")).toHaveClass("is-muted");
    expect(screen.getByText("未录制").closest(".status-chip")).toHaveClass("is-muted");
  });
});

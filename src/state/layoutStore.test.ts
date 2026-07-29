import { beforeEach, describe, expect, it } from "vitest";
import {
  defaultDashboardLayout,
  defaultWorkspaceMonitorLayout,
  loadLayout,
  resetLayout,
  saveLayout,
  validateLayout,
} from "./layoutStore";

describe("layoutStore", () => {
  beforeEach(() => localStorage.clear());

  it("rejects unknown cards and invalid sizes", () => {
    const result = validateLayout({ schemaVersion: 1, cards: [{ id: "unsafe", size: "9x9", visible: true }] });
    expect(result).toEqual(defaultDashboardLayout);
  });

  it("rejects layouts that hide the connection card", () => {
    const result = validateLayout({
      schemaVersion: 1,
      cards: [{ id: "connection", size: "1x1", visible: false }],
    });

    expect(result).toEqual(defaultDashboardLayout);
  });

  it("rejects dashboard layouts that omit the connection card", () => {
    const result = validateLayout({
      schemaVersion: 1,
      cards: [{ id: "sampling", size: "1x1", visible: true }],
    });

    expect(result).toEqual(defaultDashboardLayout);
  });

  it("prevents imported defaults from changing fallback layouts", () => {
    expect(() => {
      defaultDashboardLayout.cards[0].visible = false;
    }).toThrow(TypeError);

    expect(validateLayout({ schemaVersion: 1, cards: [{ id: "unsafe", size: "9x9", visible: true }] })).toEqual(
      defaultDashboardLayout,
    );
  });

  it("stores layouts by user and page", () => {
    saveLayout("admin", "dashboard", defaultDashboardLayout);
    expect(loadLayout("admin", "dashboard")).toEqual(defaultDashboardLayout);
    expect(loadLayout("operator", "dashboard")).toEqual(defaultDashboardLayout);
  });

  it("returns the matching page default for duplicate monitor cards", () => {
    const result = validateLayout(
      {
        schemaVersion: 1,
        cards: [
          { id: "liveChart", size: "2x2", visible: true },
          { id: "liveChart", size: "1x1", visible: false },
        ],
      },
      "workspace-monitor",
    );

    expect(result).toEqual(defaultWorkspaceMonitorLayout);
  });

  it("falls back to the page default for malformed persisted layouts", () => {
    localStorage.setItem("softui:layout:admin:workspace-monitor", "not-json");

    expect(loadLayout("admin", "workspace-monitor")).toEqual(defaultWorkspaceMonitorLayout);
  });

  it("clears only the selected user page when resetting a layout", () => {
    saveLayout("admin", "dashboard", defaultDashboardLayout);
    saveLayout("admin", "workspace-monitor", defaultWorkspaceMonitorLayout);

    resetLayout("admin", "dashboard");

    expect(localStorage.getItem("softui:layout:admin:dashboard")).toBeNull();
    expect(loadLayout("admin", "workspace-monitor")).toEqual(defaultWorkspaceMonitorLayout);
  });
});

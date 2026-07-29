import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { AppRouter } from "./AppRouter";

describe("AppRouter", () => {
  const routeSlots = {
    dashboard: <div>Dashboard content</div>,
    workspace: <div>Workspace content</div>,
    charts: <div>Charts content</div>,
    sessions: <div>Sessions content</div>,
    logs: <div>Logs content</div>,
    settings: <div>Settings content</div>,
  };

  function renderRouter(path: string) {
    render(
      <MemoryRouter initialEntries={[path]}>
        <AppRouter {...routeSlots} />
      </MemoryRouter>,
    );
  }

  afterEach(cleanup);

  it("redirects the root to dashboard", () => {
    renderRouter("/");

    expect(screen.getByText("Dashboard content")).toBeVisible();
  });

  it.each([
    ["/dashboard", "Dashboard content"],
    ["/workspace", "Workspace content"],
    ["/charts", "Charts content"],
    ["/sessions", "Sessions content"],
    ["/logs", "Logs content"],
    ["/settings", "Settings content"],
  ])("renders %s directly", (path, expectedContent) => {
    renderRouter(path);

    expect(screen.getByText(expectedContent)).toBeVisible();
  });

  it.each(["/connection", "/live-table", "/calibration", "/playback", "/model"])(
    "redirects %s to workspace",
    (path) => {
      renderRouter(path);

      expect(screen.getByText("Workspace content")).toBeVisible();
    },
  );
});

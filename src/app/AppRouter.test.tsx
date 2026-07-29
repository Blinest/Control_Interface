import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRouter } from "./AppRouter";

describe("AppRouter", () => {
  it("redirects the root to dashboard", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AppRouter
          dashboard={<div>Dashboard content</div>}
          workspace={<div />}
          charts={<div />}
          sessions={<div />}
          logs={<div />}
          settings={<div />}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Dashboard content")).toBeVisible();
  });
});

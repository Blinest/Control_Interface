import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function Boom(): ReactNode {
  throw new Error("render failure");
}

describe("ErrorBoundary", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows a recoverable crash fallback", () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("heading", { name: "界面发生错误" })).toBeVisible();
    expect(screen.getByRole("button", { name: "重新加载" })).toBeVisible();
  });
});

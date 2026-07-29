import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("frontend test harness", () => {
  it("renders React content", () => {
    render(<button type="button">杩炴帴璁惧</button>);
    expect(screen.getByRole("button", { name: "杩炴帴璁惧" })).toBeVisible();
  });
});

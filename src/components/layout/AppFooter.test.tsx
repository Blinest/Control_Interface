import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppFooter } from "./AppFooter";

describe("AppFooter", () => {
  it("renders duplicate footer items without duplicate-key warnings", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    render(<AppFooter items={["采样 100 Hz", "采样 100 Hz"]} />);

    expect(consoleError).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

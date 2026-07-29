import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { makeFallbackSnapshot } from "./fallbackSnapshot";

describe("makeFallbackSnapshot", () => {
  const root = document.documentElement;
  let originalTheme: string | undefined;
  let originalColorScheme: string;

  beforeEach(() => {
    localStorage.clear();
    originalTheme = root.dataset.theme;
    originalColorScheme = root.style.colorScheme;
  });

  afterEach(() => {
    if (originalTheme === undefined) {
      delete root.dataset.theme;
    } else {
      root.dataset.theme = originalTheme;
    }
    root.style.colorScheme = originalColorScheme;
  });

  it("keeps the pre-rendered theme instead of a legacy global preference", () => {
    root.dataset.theme = "light";
    root.style.colorScheme = "light";
    localStorage.setItem("softui:theme", "dark");

    expect(makeFallbackSnapshot().theme).toBe("light");
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { applyTheme, readThemePreference, resolveTheme, writeThemePreference } from "./themeStore";

describe("themeStore", () => {
  beforeEach(() => localStorage.clear());

  it("uses the system theme before a user override exists", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
  });

  it("stores the choice per authenticated user", () => {
    writeThemePreference("admin", "dark");
    expect(readThemePreference("admin")).toBe("dark");
    expect(readThemePreference("operator")).toBe("system");
  });

  it("applies the theme without changing component geometry", () => {
    const root = document.documentElement;
    applyTheme("light", root);
    expect(root.dataset.theme).toBe("light");
    expect(root.style.colorScheme).toBe("light");
  });
});

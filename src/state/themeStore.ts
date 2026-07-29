import type { ThemeMode } from "../softuiTypes";

export type ThemePreference = ThemeMode | "system";

const keyFor = (username: string) => `softui:theme:${username || "anonymous"}`;

export function resolveTheme(preference: ThemePreference, systemDark: boolean): ThemeMode {
  return preference === "system" ? (systemDark ? "dark" : "light") : preference;
}

export function readThemePreference(username: string): ThemePreference {
  const value = localStorage.getItem(keyFor(username));
  return value === "light" || value === "dark" ? value : "system";
}

export function writeThemePreference(username: string, value: ThemePreference): void {
  localStorage.setItem(keyFor(username), value);
}

export function applyTheme(theme: ThemeMode, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
}

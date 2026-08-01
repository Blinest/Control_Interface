import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import shell from "./shell.css?raw";
import tokens from "./tokens.css?raw";

const appCss = readFileSync("src/App.css", "utf8");

const themeTokens = {
  light: tokens.match(/:root,\s*:root\[data-theme="light"\]\s*\{([\s\S]*?)\}/)?.[1] ?? "",
  dark: tokens.match(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/)?.[1] ?? "",
};

const tokenValue = (theme: keyof typeof themeTokens, name: string): string => {
  const value = themeTokens[theme].match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  if (!value) throw new Error(`Missing ${name} ${theme} token`);
  return value;
};

const luminance = (hex: string): number => {
  const channels = hex.slice(1).match(/../g)?.map((channel) => parseInt(channel, 16) / 255);
  if (!channels) throw new Error(`Invalid hex color: ${hex}`);
  const [red, green, blue] = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const contrast = (foreground: string, background: string): number => {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
};

describe("semantic token contrast", () => {
  it("keeps muted text readable on page and panel surfaces", () => {
    expect(contrast(tokenValue("light", "--text-muted"), "#edf2f6")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokenValue("light", "--text-muted"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps disabled text readable on its disabled background", () => {
    expect(contrast(tokenValue("light", "--action-disabled-text"), "#dce4eb")).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["light", "dark"] as const)("keeps sidebar text readable in %s mode", (theme) => {
    const sidebar = tokenValue(theme, "--surface-sidebar");
    expect(contrast(tokenValue(theme, "--text-sidebar"), sidebar)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokenValue(theme, "--text-sidebar-muted"), sidebar)).toBeGreaterThanOrEqual(4.5);
  });

  it("maps sidebar brand, navigation, and group labels to sidebar semantic tokens", () => {
    expect(shell).toMatch(/\.app-sidebar\s*\{[^}]*color:\s*var\(--text-sidebar\)/);
    expect(shell).toMatch(/\.sidebar-nav-link\s*\{[^}]*color:\s*var\(--text-sidebar\)/);
    expect(shell).toMatch(/\.sidebar-nav-group h2\s*\{[^}]*color:\s*var\(--text-sidebar-muted\)/);
  });
});

describe("button contrast tokens", () => {
  it.each(["light", "dark"] as const)("defines explicit button and disabled colors in %s mode", (theme) => {
    for (const name of [
      "--button-default-bg",
      "--button-default-text",
      "--button-default-border",
      "--button-primary-bg",
      "--button-primary-text",
      "--button-danger-bg",
      "--button-danger-text",
      "--button-disabled-bg",
      "--button-disabled-text",
      "--button-disabled-border",
    ]) {
      expect(tokenValue(theme, name)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it.each(["light", "dark"] as const)("keeps button text readable in %s mode", (theme) => {
    for (const [background, text] of [
      ["--button-default-bg", "--button-default-text"],
      ["--button-primary-bg", "--button-primary-text"],
      ["--button-danger-bg", "--button-danger-text"],
      ["--button-disabled-bg", "--button-disabled-text"],
    ]) {
      expect(contrast(tokenValue(theme, text), tokenValue(theme, background))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("does not rely on opacity for disabled button readability", () => {
    expect(appCss).not.toMatch(/button:disabled\s*\{[^}]*opacity:\s*0\.[0-9]/);
  });
});

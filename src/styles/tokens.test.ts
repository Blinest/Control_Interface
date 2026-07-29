import { describe, expect, it } from "vitest";
import tokens from "./tokens.css?raw";

const lightTokens = tokens.match(/:root,\s*:root\[data-theme="light"\]\s*\{([\s\S]*?)\}/)?.[1] ?? "";

const tokenValue = (name: string): string => {
  const value = lightTokens.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  if (!value) throw new Error(`Missing ${name} light token`);
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

describe("light semantic token contrast", () => {
  it("keeps muted text readable on page and panel surfaces", () => {
    expect(contrast(tokenValue("--text-muted"), "#edf2f6")).toBeGreaterThanOrEqual(4.5);
    expect(contrast(tokenValue("--text-muted"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps disabled text readable on its disabled background", () => {
    expect(contrast(tokenValue("--action-disabled-text"), "#dce4eb")).toBeGreaterThanOrEqual(4.5);
  });
});

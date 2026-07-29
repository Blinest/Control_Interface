import { describe, expect, it } from "vitest";
import { reconcileCurrentDevice, reconcileDeviceRefresh } from "./deviceSelectionStore";

describe("reconcileCurrentDevice", () => {
  it("keeps an available explicit selection", () => {
    expect(reconcileCurrentDevice("serial:COM4", ["serial:COM3", "serial:COM4"])).toBe("serial:COM4");
  });

  it("falls back to the first available device", () => {
    expect(reconcileCurrentDevice("serial:COM9", ["serial:COM3"])).toBe("serial:COM3");
  });

  it("returns an empty selection when no device exists", () => {
    expect(reconcileCurrentDevice("serial:COM3", [])).toBe("");
  });

  it("discards an out-of-order refresh so it cannot overwrite the latest selection", () => {
    expect(reconcileDeviceRefresh(1, 2, "serial:COM4", ["serial:COM3"])).toBeNull();
  });
});

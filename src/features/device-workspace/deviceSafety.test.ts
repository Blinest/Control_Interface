import { describe, expect, it } from "vitest";
import {
  createConfirmationSafetyContext,
  getLatchedDeviceIds,
  resolveRecoveryDeviceId,
  shouldInvalidateConfirmation,
} from "./deviceSafety";

const statuses = (entries: Record<string, boolean>) => Object.fromEntries(
  Object.entries(entries).map(([deviceId, emergencyLatched]) => [deviceId, { emergencyLatched }]),
);

describe("recovery device targeting", () => {
  it("targets the actual latched device instead of the selected unlatched device", () => {
    const deviceStatuses = statuses({ "serial:COM3": true, "serial:COM4": false });

    expect(getLatchedDeviceIds(deviceStatuses)).toEqual(["serial:COM3"]);
    expect(resolveRecoveryDeviceId(deviceStatuses)).toBe("serial:COM3");
    expect(resolveRecoveryDeviceId(deviceStatuses, "serial:COM4")).toBeNull();
  });

  it("requires an explicit latched target when multiple devices are latched", () => {
    const deviceStatuses = statuses({ "serial:COM3": true, "serial:COM4": true });

    expect(resolveRecoveryDeviceId(deviceStatuses)).toBeNull();
    expect(resolveRecoveryDeviceId(deviceStatuses, "serial:COM4")).toBe("serial:COM4");
  });
});

describe("confirmation invalidation", () => {
  it("invalidates a pending confirmation when device selection changes", () => {
    const deviceStatuses = statuses({ "serial:COM3": false, "serial:COM4": false });
    const previous = createConfirmationSafetyContext("serial:COM3", false, deviceStatuses);
    const current = createConfirmationSafetyContext("serial:COM4", false, deviceStatuses);

    expect(shouldInvalidateConfirmation(previous, current)).toBe(true);
  });

  it.each([
    [false, true],
    [true, false],
  ])("invalidates when the aggregate latch changes from %s to %s", (previousLatch, currentLatch) => {
    const deviceStatuses = statuses({ "serial:COM3": false });
    const previous = createConfirmationSafetyContext("serial:COM3", previousLatch, deviceStatuses);
    const current = createConfirmationSafetyContext("serial:COM3", currentLatch, deviceStatuses);

    expect(shouldInvalidateConfirmation(previous, current)).toBe(true);
  });

  it.each([
    [false, true],
    [true, false],
  ])("invalidates when a device latch changes from %s to %s", (previousLatch, currentLatch) => {
    const previous = createConfirmationSafetyContext("serial:COM3", false, statuses({ "serial:COM3": previousLatch }));
    const current = createConfirmationSafetyContext("serial:COM3", false, statuses({ "serial:COM3": currentLatch }));

    expect(shouldInvalidateConfirmation(previous, current)).toBe(true);
  });

  it("keeps a pending confirmation when refreshed safety data is unchanged", () => {
    const previous = createConfirmationSafetyContext("serial:COM3", false, statuses({ "serial:COM3": false }));
    const current = createConfirmationSafetyContext("serial:COM3", false, statuses({ "serial:COM3": false }));

    expect(shouldInvalidateConfirmation(previous, current)).toBe(false);
  });
});

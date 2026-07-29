import type { DeviceSnapshot, RuntimeSnapshot } from "../../softuiTypes";

export function framesForDevice(snapshot: RuntimeSnapshot, deviceId: string): DeviceSnapshot[] {
  if (!deviceId) return [];
  return snapshot.live.frames.filter((frame) => frame.deviceId === deviceId);
}

export function latestFrameForDevice(
  snapshot: RuntimeSnapshot,
  deviceId: string,
): DeviceSnapshot | undefined {
  return framesForDevice(snapshot, deviceId)[0];
}

export type DeviceLatchStatuses = Record<string, { emergencyLatched: boolean }>;

export interface ConfirmationSafetyContext {
  selectedDeviceId: string;
  aggregateEmergencyLatched: boolean;
  deviceLatchState: string;
  connectedDeviceTopology: string;
}

export function getLatchedDeviceIds(deviceStatuses: DeviceLatchStatuses): string[] {
  return Object.entries(deviceStatuses)
    .filter(([, status]) => status.emergencyLatched)
    .map(([deviceId]) => deviceId)
    .sort();
}

export function resolveRecoveryDeviceId(
  deviceStatuses: DeviceLatchStatuses,
  requestedDeviceId?: string,
): string | null {
  const latchedDeviceIds = getLatchedDeviceIds(deviceStatuses);
  if (requestedDeviceId !== undefined) {
    return latchedDeviceIds.includes(requestedDeviceId) ? requestedDeviceId : null;
  }

  return latchedDeviceIds.length === 1 ? latchedDeviceIds[0] : null;
}

export function createConfirmationSafetyContext(
  selectedDeviceId: string,
  aggregateEmergencyLatched: boolean,
  deviceStatuses: DeviceLatchStatuses,
  connectedDeviceIds: readonly string[] = [],
): ConfirmationSafetyContext {
  const deviceLatchState = Object.entries(deviceStatuses)
    .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
    .map(([deviceId, status]) => `${deviceId}:${status.emergencyLatched ? "1" : "0"}`)
    .join("|");

  return {
    selectedDeviceId,
    aggregateEmergencyLatched,
    deviceLatchState,
    connectedDeviceTopology: JSON.stringify(connectedDeviceIds),
  };
}

export function shouldInvalidateConfirmation(
  previous: ConfirmationSafetyContext,
  current: ConfirmationSafetyContext,
): boolean {
  return previous.selectedDeviceId !== current.selectedDeviceId
    || previous.aggregateEmergencyLatched !== current.aggregateEmergencyLatched
    || previous.deviceLatchState !== current.deviceLatchState
    || previous.connectedDeviceTopology !== current.connectedDeviceTopology;
}

export function reconcileCurrentDevice(selected: string, available: string[]): string {
  if (selected && available.includes(selected)) return selected;
  return available[0] ?? "";
}

export function reconcileDeviceRefresh(
  responseId: number,
  latestRequestId: number,
  selected: string,
  available: string[],
): string | null {
  if (responseId !== latestRequestId) return null;
  return reconcileCurrentDevice(selected, available);
}

export function selectCurrentDevice(deviceId: string): void {
  localStorage.setItem("softui:currentDeviceId", deviceId);
}

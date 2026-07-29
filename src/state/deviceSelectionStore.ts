export function reconcileCurrentDevice(selected: string, available: string[]): string {
  if (selected && available.includes(selected)) return selected;
  return available[0] ?? "";
}

export function selectCurrentDevice(deviceId: string): void {
  localStorage.setItem("softui:currentDeviceId", deviceId);
}

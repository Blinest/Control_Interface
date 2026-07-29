import type { PlaybackStatus, SessionInfo } from "../../softuiTypes";

export function sessionBelongsToDevice(session: SessionInfo, deviceId: string): boolean {
  return Boolean(deviceId) && (
    session.deviceId === deviceId || session.deviceIds?.includes(deviceId) === true
  );
}

export function isPlaybackForDevice(
  status: PlaybackStatus | null,
  sessions: SessionInfo[],
  deviceId: string,
): boolean {
  if (!status?.active || !deviceId) return false;
  const session = sessions.find((candidate) => candidate.id === status.sessionId);
  return session ? sessionBelongsToDevice(session, deviceId) : false;
}

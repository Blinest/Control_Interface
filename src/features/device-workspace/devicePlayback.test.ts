import { describe, expect, it } from "vitest";
import type { PlaybackStatus, SessionInfo } from "../../softuiTypes";
import { isPlaybackForDevice } from "./devicePlayback";

const sessions: SessionInfo[] = [
  {
    id: "session-a",
    name: "Device A",
    startTime: "2026-07-29T09:00:00+08:00",
    endTime: null,
    deviceId: "device-a",
    deviceIds: ["device-a"],
    frameCount: 10,
    fileSize: 100,
    filePath: "a.jsonl",
  },
];

const playbackStatus: PlaybackStatus = {
  active: true,
  sessionId: "session-a",
  playing: true,
  speed: 1,
  cursorMs: 0,
  durationMs: 1_000,
  cursorPct: 0,
  totalFrames: 10,
  currentFrameIdx: 0,
};

describe("isPlaybackForDevice", () => {
  it("requires the active session to belong to the current device", () => {
    expect(isPlaybackForDevice(playbackStatus, sessions, "device-a")).toBe(true);
    expect(isPlaybackForDevice(playbackStatus, sessions, "device-b")).toBe(false);
    expect(isPlaybackForDevice(playbackStatus, [], "device-a")).toBe(false);
  });
});

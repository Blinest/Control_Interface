import { describe, expect, it } from "vitest";
import { tauriClient } from "./tauriClient";

describe("tauriClient", () => {
  it("uses a browser fallback when the Tauri invoke bridge is not available", async () => {
    const snapshot = await tauriClient.bootstrap();

    expect(snapshot.appInfo.name).toBe("SoftUI");
    expect(snapshot.live.selectedDeviceId).toBe("softui-sim-01");
  });

  it("keeps tick usable in a plain Vite browser session", async () => {
    const snapshot = await tauriClient.tick();

    expect(snapshot.connection.state).toBe("ready");
  });
});

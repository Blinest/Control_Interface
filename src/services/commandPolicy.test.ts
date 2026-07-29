import { describe, expect, it } from "vitest";
import { buildCommandConfirmation, type CommandKind } from "./commandPolicy";

describe("commandPolicy", () => {
  it("never confirms emergency stop", () => {
    expect(buildCommandConfirmation("emergencyStop", { deviceId: "serial:COM3" })).toBeNull();
  });

  it("shows device and parameters for motor movement", () => {
    const result = buildCommandConfirmation("motorMove", { deviceId: "serial:COM3", motorId: 2, positionMm: 12.5 });

    expect(result).toMatchObject({ level: "danger", confirmLabel: "确认发送" });
    expect(result?.details).toContain("设备：serial:COM3");
    expect(result?.details).toContain("目标位置：12.5 mm");
  });

  it.each([
    "recover",
    "enable",
    "disconnect",
    "motorMove",
    "home",
    "calibrate",
    "bend",
    "activeControl",
    "cycleControl",
    "deleteSession",
    "resetPassword",
    "changeRole",
    "runMigration",
  ] satisfies CommandKind[])("returns fixed Chinese copy and payload details for %s", (kind) => {
    const result = buildCommandConfirmation(kind, { deviceId: "serial:COM3", requestId: "request-42" });

    expect(result).not.toBeNull();
    expect(result?.title).toMatch(/[\u4e00-\u9fff]/);
    expect(result?.confirmLabel).toMatch(/[\u4e00-\u9fff]/);
    expect(result?.details).toEqual(expect.arrayContaining(["设备：serial:COM3", "requestId：request-42"]));
  });
});

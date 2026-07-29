import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSafeCommand } from "./useSafeCommand";

describe("useSafeCommand", () => {
  it("executes emergency stop without opening confirmation", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSafeCommand());

    await act(() => result.current.execute("emergencyStop", { deviceId: "serial:COM3" }, action));

    expect(action).toHaveBeenCalledOnce();
    expect(result.current.confirmation).toBeNull();
  });

  it("waits for confirmation before recovering control", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSafeCommand());

    await act(() => result.current.execute("recover", { deviceId: "serial:COM3" }, action));

    expect(action).not.toHaveBeenCalled();
    expect(result.current.confirmation).toMatchObject({ level: "danger" });

    await act(() => result.current.confirm());

    expect(action).toHaveBeenCalledOnce();
    expect(result.current.confirmation).toBeNull();
  });

  it("clears a pending command when emergency stop executes", async () => {
    const motionAction = vi.fn().mockResolvedValue(undefined);
    const emergencyAction = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useSafeCommand());

    await act(() => result.current.execute("motorMove", { deviceId: "serial:COM3" }, motionAction));
    await act(() => result.current.execute("emergencyStop", { deviceId: "serial:COM3" }, emergencyAction));

    expect(emergencyAction).toHaveBeenCalledOnce();
    expect(motionAction).not.toHaveBeenCalled();
    expect(result.current.confirmation).toBeNull();
  });
});

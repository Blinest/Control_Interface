import { invoke } from "@tauri-apps/api/core";
import type { RuntimeSnapshot } from "../softuiTypes";
import { makeFallbackSnapshot } from "../state/fallbackSnapshot";
import { getVisualSmokeResponse, isVisualSmokeMode } from "../test/visualRoutes";

export interface TauriClient {
  bootstrap(): Promise<RuntimeSnapshot>;
  tick(): Promise<RuntimeSnapshot>;
  submitSystemControl(deviceId: string, action: "enable" | "disable" | "emergencyStop"): Promise<RuntimeSnapshot>;
  sendMotorCommand(request: Record<string, unknown>): Promise<RuntimeSnapshot>;
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}

function hasTauriInvokeBridge() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function invokeOrFallback<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  if (isVisualSmokeMode()) return Promise.resolve(getVisualSmokeResponse(command) as T);
  if (hasTauriInvokeBridge()) return invoke<T>(command, args);
  if (command === "bootstrap_state" || command === "tick_snapshot") {
    return Promise.resolve(makeFallbackSnapshot() as T);
  }
  return Promise.reject(new Error(`Tauri command "${command}" is unavailable outside the desktop runtime.`));
}

export const tauriClient: TauriClient = {
  bootstrap: () => invokeOrFallback("bootstrap_state"),
  tick: () => invokeOrFallback("tick_snapshot"),
  submitSystemControl: (deviceId, action) => invokeOrFallback("submit_system_control", { request: { deviceId, action } }),
  sendMotorCommand: (request) => invokeOrFallback("send_motor_command", { request }),
  invoke: (command, args) => invokeOrFallback(command, args),
};

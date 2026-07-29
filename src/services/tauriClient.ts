import { invoke } from "@tauri-apps/api/core";
import type { RuntimeSnapshot } from "../softuiTypes";

export interface TauriClient {
  bootstrap(): Promise<RuntimeSnapshot>;
  tick(): Promise<RuntimeSnapshot>;
  submitSystemControl(deviceId: string, action: "enable" | "disable" | "emergencyStop"): Promise<RuntimeSnapshot>;
  sendMotorCommand(request: Record<string, unknown>): Promise<RuntimeSnapshot>;
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;
}

export const tauriClient: TauriClient = {
  bootstrap: () => invoke("bootstrap_state"),
  tick: () => invoke("tick_snapshot"),
  submitSystemControl: (deviceId, action) => invoke("submit_system_control", { request: { deviceId, action } }),
  sendMotorCommand: (request) => invoke("send_motor_command", { request }),
  invoke: (command, args) => invoke(command, args),
};

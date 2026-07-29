export type CommandKind =
  | "emergencyStop" | "recover" | "enable" | "disconnect"
  | "motorMove" | "home" | "calibrate" | "bend"
  | "activeControl" | "cycleControl" | "deleteSession"
  | "resetPassword" | "changeRole" | "runMigration";

export interface CommandConfirmation {
  title: string;
  level: "warning" | "danger";
  details: string[];
  confirmLabel: string;
}

type Policy = Omit<CommandConfirmation, "details">;

const commandPolicies: Record<Exclude<CommandKind, "emergencyStop">, Policy> = {
  recover: { title: "确认恢复控制", level: "danger", confirmLabel: "确认恢复" },
  enable: { title: "确认启用设备", level: "warning", confirmLabel: "确认启用" },
  disconnect: { title: "确认断开设备", level: "danger", confirmLabel: "确认断开" },
  motorMove: { title: "确认电机运动", level: "danger", confirmLabel: "确认发送" },
  home: { title: "确认执行回零", level: "danger", confirmLabel: "确认回零" },
  calibrate: { title: "确认执行校准", level: "danger", confirmLabel: "确认校准" },
  bend: { title: "确认执行弯曲", level: "danger", confirmLabel: "确认发送" },
  activeControl: { title: "确认启动主动控制", level: "danger", confirmLabel: "确认启动" },
  cycleControl: { title: "确认执行循环控制", level: "danger", confirmLabel: "确认执行" },
  deleteSession: { title: "确认删除会话", level: "danger", confirmLabel: "确认删除" },
  resetPassword: { title: "确认重置密码", level: "danger", confirmLabel: "确认重置" },
  changeRole: { title: "确认变更角色", level: "danger", confirmLabel: "确认变更" },
  runMigration: { title: "确认执行迁移", level: "danger", confirmLabel: "确认迁移" },
};

const detailLabels: Record<string, string> = {
  deviceId: "设备",
  motorId: "电机",
  positionMm: "目标位置",
  velocityMmPerSec: "速度",
  accelerationMmPerSec2: "加速度",
  sessionId: "会话",
  username: "用户",
  role: "角色",
  source: "来源",
  sourcePath: "来源路径",
};

function formatDetail(key: string, value: unknown): string {
  const label = detailLabels[key] ?? key;
  const unit = key === "positionMm" ? " mm" : key === "velocityMmPerSec" ? " mm/s" : key === "accelerationMmPerSec2" ? " mm/s²" : "";
  const formattedValue = typeof value === "string" ? value : JSON.stringify(value);

  return `${label}：${formattedValue}${unit}`;
}

export function buildCommandConfirmation(kind: CommandKind, payload: Record<string, unknown>): CommandConfirmation | null {
  if (kind === "emergencyStop") return null;

  return {
    ...commandPolicies[kind],
    details: Object.entries(payload).map(([key, value]) => formatDetail(key, value)),
  };
}

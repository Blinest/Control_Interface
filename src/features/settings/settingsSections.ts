export type SettingsSection =
  | "application"
  | "appearance"
  | "connection"
  | "accounts"
  | "diagnostics"
  | "migration";

export const settingsSections: ReadonlyArray<{ id: SettingsSection; label: string }> = [
  { id: "application", label: "应用与路径" },
  { id: "appearance", label: "外观与布局" },
  { id: "connection", label: "连接配置" },
  { id: "accounts", label: "账户与权限" },
  { id: "diagnostics", label: "日志与诊断" },
  { id: "migration", label: "数据迁移" },
];

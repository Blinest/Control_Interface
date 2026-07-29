import { BarChart3, Cpu, Database, LayoutDashboard, Logs, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PageKey } from "../softuiTypes";

export interface NavigationItem {
  key: PageKey;
  path: string;
  label: string;
  icon: LucideIcon;
}

export const navigationGroups = [
  { label: "运行", items: [
    { key: "Dashboard", path: "/dashboard", label: "总览", icon: LayoutDashboard },
    { key: "Workspace", path: "/workspace", label: "设备工作台", icon: Cpu },
    { key: "Charts", path: "/charts", label: "曲线分析", icon: BarChart3 },
  ] },
  { label: "数据", items: [
    { key: "Sessions", path: "/sessions", label: "会话与记录", icon: Database },
    { key: "Logs", path: "/logs", label: "日志与诊断", icon: Logs },
  ] },
  { label: "系统", items: [
    { key: "Settings", path: "/settings", label: "系统设置", icon: Settings2 },
  ] },
] satisfies Array<{ label: string; items: NavigationItem[] }>;

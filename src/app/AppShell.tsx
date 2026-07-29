import type { ReactNode } from "react";
import { AppFooter } from "../components/layout/AppFooter";
import { GlobalStatusBar } from "../components/layout/GlobalStatusBar";
import { PageTabs } from "../components/layout/PageTabs";
import { SidebarNav } from "../components/layout/SidebarNav";
import "../styles/shell.css";

export interface AppShellProps {
  children: ReactNode;
  currentDeviceLabel: string;
  connectionLabel: string;
  currentUserLabel?: string;
  enabled: boolean;
  recording: boolean;
  emergencyLatched: boolean;
  footerItems: string[];
  onEmergencyStop: () => void;
  onLogout?: () => void;
}

export function AppShell({
  children,
  currentDeviceLabel,
  connectionLabel,
  currentUserLabel,
  enabled,
  recording,
  emergencyLatched,
  footerItems,
  onEmergencyStop,
  onLogout,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <SidebarNav />
      <GlobalStatusBar
        connectionLabel={connectionLabel}
        currentDeviceLabel={currentDeviceLabel}
        currentUserLabel={currentUserLabel}
        emergencyLatched={emergencyLatched}
        enabled={enabled}
        onEmergencyStop={onEmergencyStop}
        onLogout={onLogout}
        recording={recording}
      />
      <main className="app-content">
        <PageTabs />
        <div className="app-page-content">{children}</div>
      </main>
      <AppFooter items={footerItems} />
    </div>
  );
}

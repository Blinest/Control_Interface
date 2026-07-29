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
  enabled: boolean;
  recording: boolean;
  emergencyLatched: boolean;
  footerItems: string[];
  onEmergencyStop: () => void;
}

export function AppShell({
  children,
  currentDeviceLabel,
  connectionLabel,
  enabled,
  recording,
  emergencyLatched,
  footerItems,
  onEmergencyStop,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <SidebarNav />
      <GlobalStatusBar
        connectionLabel={connectionLabel}
        currentDeviceLabel={currentDeviceLabel}
        emergencyLatched={emergencyLatched}
        enabled={enabled}
        onEmergencyStop={onEmergencyStop}
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

import { useState, type ReactNode } from "react";
import { AppFooter } from "../components/layout/AppFooter";
import { GlobalStatusBar } from "../components/layout/GlobalStatusBar";
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div
      className={`app-shell${sidebarCollapsed ? " is-sidebar-collapsed" : ""}`}
      data-testid="app-shell"
    >
      <SidebarNav
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
      />
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
        <div className="app-page-content">{children}</div>
      </main>
      <AppFooter items={footerItems} />
    </div>
  );
}

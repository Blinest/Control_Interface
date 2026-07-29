import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

export interface AppRouterProps {
  dashboard: ReactNode;
  workspace: ReactNode;
  charts: ReactNode;
  sessions: ReactNode;
  logs: ReactNode;
  settings: ReactNode;
}

export function AppRouter({
  dashboard,
  workspace,
  charts,
  sessions,
  logs,
  settings,
}: AppRouterProps) {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={dashboard} />
      <Route path="/workspace" element={workspace} />
      <Route path="/charts" element={charts} />
      <Route path="/sessions" element={sessions} />
      <Route path="/logs" element={logs} />
      <Route path="/settings" element={settings} />
      <Route path="/connection" element={<Navigate to="/workspace" replace />} />
      <Route path="/live-table" element={<Navigate to="/workspace" replace />} />
      <Route path="/calibration" element={<Navigate to="/workspace" replace />} />
      <Route path="/playback" element={<Navigate to="/workspace" replace />} />
      <Route path="/model" element={<Navigate to="/workspace" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

import type * as React from "react";
import "../styles/layouts.css";

export interface DashboardLayoutProps {
  summary: React.ReactNode;
  children: React.ReactNode;
}

export function DashboardLayout({ summary, children }: DashboardLayoutProps) {
  return (
    <section className="dashboard-layout">
      <header className="dashboard-summary">{summary}</header>
      <main className="layout-scroll-region">{children}</main>
    </section>
  );
}

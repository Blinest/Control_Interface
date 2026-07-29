import type * as React from "react";
import "../styles/layouts.css";

export interface WorkbenchLayoutProps {
  context: React.ReactNode;
  tabs: React.ReactNode;
  children: React.ReactNode;
}

export function WorkbenchLayout({ context, tabs, children }: WorkbenchLayoutProps) {
  return (
    <section className="workbench-layout">
      <aside className="workbench-context layout-scroll-region">{context}</aside>
      <header className="workbench-tabs">{tabs}</header>
      <main className="layout-scroll-region">{children}</main>
    </section>
  );
}

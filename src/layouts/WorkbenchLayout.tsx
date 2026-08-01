import type * as React from "react";
import { ResponsiveRail } from "../components/layout/ResponsiveRail";
import "../styles/layouts.css";

export interface WorkbenchLayoutProps {
  context: React.ReactNode;
  tabs: React.ReactNode;
  children: React.ReactNode;
}

export function WorkbenchLayout({ context, tabs, children }: WorkbenchLayoutProps) {
  return (
    <section className="workbench-layout">
      <ResponsiveRail className="workbench-context" label="Workbench context">
        {context}
      </ResponsiveRail>
      <header className="workbench-tabs">{tabs}</header>
      <main className="layout-scroll-region">{children}</main>
    </section>
  );
}

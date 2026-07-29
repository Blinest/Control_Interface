import type * as React from "react";
import "../styles/layouts.css";

export interface ChartLayoutProps {
  channels: React.ReactNode;
  toolbar: React.ReactNode;
  children: React.ReactNode;
}

export function ChartLayout({ channels, toolbar, children }: ChartLayoutProps) {
  return (
    <section className="chart-layout">
      <aside className="chart-channels">{channels}</aside>
      <header className="chart-toolbar">{toolbar}</header>
      <main className="layout-scroll-region">{children}</main>
    </section>
  );
}

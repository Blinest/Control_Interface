import type * as React from "react";
import "../styles/layouts.css";

export interface ChartLayoutProps {
  channels: React.ReactNode;
  toolbar: React.ReactNode;
  children: React.ReactNode;
  channelsLabel?: string;
  toolbarLabel?: string;
}

export function ChartLayout({ channels, toolbar, children, channelsLabel, toolbarLabel }: ChartLayoutProps) {
  return (
    <section className="chart-layout">
      <aside className="chart-channels" aria-label={channelsLabel}>{channels}</aside>
      <header className="chart-toolbar" aria-label={toolbarLabel}>{toolbar}</header>
      <main className="layout-scroll-region">{children}</main>
    </section>
  );
}

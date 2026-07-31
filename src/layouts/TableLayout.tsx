import type * as React from "react";
import "../styles/layouts.css";

export interface TableLayoutProps {
  toolbar: React.ReactNode;
  children: React.ReactNode;
  detail?: React.ReactNode;
  detailLabel?: string;
}

export function TableLayout({ toolbar, children, detail, detailLabel }: TableLayoutProps) {
  return (
    <section className="table-layout">
      <header className="table-toolbar">{toolbar}</header>
      <div className="table-layout-content">
        <main className="layout-scroll-region">{children}</main>
        {detail ? <aside className="table-detail layout-scroll-region" aria-label={detailLabel}>{detail}</aside> : null}
      </div>
    </section>
  );
}

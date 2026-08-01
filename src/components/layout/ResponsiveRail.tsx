import type * as React from "react";

export interface ResponsiveRailProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveRail({ label, children, className }: ResponsiveRailProps) {
  return (
    <aside className={`responsive-rail ${className ?? ""}`} aria-label={label}>
      <div className="responsive-rail-title">{label}</div>
      <div className="responsive-rail-scroll">{children}</div>
    </aside>
  );
}

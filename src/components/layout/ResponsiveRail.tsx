import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import type * as React from "react";

export interface ResponsiveRailProps {
  label: string;
  children: React.ReactNode;
  className?: string;
}

export function ResponsiveRail({ label, children, className }: ResponsiveRailProps) {
  const [collapsed, setCollapsed] = useState(false);
  const Icon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside className={`responsive-rail ${collapsed ? "is-collapsed" : ""} ${className ?? ""}`} aria-label={label}>
      <div className="responsive-rail-title">
        <span>{label}</span>
        <button
          aria-label={`${collapsed ? "展开" : "收起"}${label}`}
          className="responsive-rail-toggle"
          onClick={() => setCollapsed((value) => !value)}
          type="button"
        >
          <Icon aria-hidden="true" size={15} />
        </button>
      </div>
      <div className="responsive-rail-scroll" aria-hidden={collapsed}>
        {children}
      </div>
    </aside>
  );
}

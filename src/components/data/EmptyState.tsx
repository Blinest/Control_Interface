import type { ComponentType, ReactNode } from "react";
import "./data.css";

export interface EmptyStateProps {
  title: string;
  reason: string;
  context?: string;
  action?: ReactNode;
  icon?: ComponentType<{ size?: number }>;
  density?: "compact" | "comfortable" | "fill";
}

export function EmptyState({ title, reason, context, action, icon: Icon, density = "comfortable" }: EmptyStateProps) {
  return (
    <section className={`data-empty-state empty-state-${density}`}>
      <div className="data-empty-state-inner">
        {Icon ? <Icon size={28} /> : null}
        <h2 className="data-empty-state-title">{title}</h2>
        <p className="data-empty-state-reason">{reason}</p>
        {context ? <p className="data-empty-state-context">{context}</p> : null}
        {action ? <div className="data-empty-state-action">{action}</div> : null}
      </div>
    </section>
  );
}

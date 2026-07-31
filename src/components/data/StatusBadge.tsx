import "./data.css";

export type StatusBadgeTone = "ok" | "warning" | "error" | "info" | "bug" | "neutral";

export interface StatusBadgeProps {
  label: string;
  tone?: StatusBadgeTone;
}

export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge-${tone}`}>
      <span className="status-badge-dot" />
      <span>{label}</span>
    </span>
  );
}

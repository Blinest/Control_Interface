import "./data.css";

export interface PathValueProps {
  value: string;
  compact?: boolean;
}

export function PathValue({ value, compact = false }: PathValueProps) {
  return (
    <span
      className={`path-value${compact ? " path-value-compact" : ""}`}
      title={value}
    >
      {value}
    </span>
  );
}

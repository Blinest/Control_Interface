import { useEffect, useId, useRef } from "react";
import "./feedback.css";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  details: string[];
  confirmLabel: string;
  level: "warning" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  details,
  confirmLabel,
  level,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const detailsId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    (level === "warning" ? confirmRef : cancelRef).current?.focus();
  }, [level, open]);

  if (!open) return null;

  return (
    <div className="confirm-dialog-backdrop" onMouseDown={onCancel}>
      <section
        aria-describedby={detailsId}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`confirm-dialog confirm-dialog-${level}`}
        onMouseDown={(event) => event.stopPropagation()}
        role="alertdialog"
      >
        <h2 id={titleId}>{title}</h2>
        <ul id={detailsId}>
          {details.map((detail) => <li key={detail}>{detail}</li>)}
        </ul>
        <div className="confirm-dialog-actions">
          <button ref={cancelRef} type="button" className="ghost-btn" onClick={onCancel}>取消</button>
          <button ref={confirmRef} type="button" className="primary-btn" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}

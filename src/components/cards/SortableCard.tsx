import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { CardPlacement } from "../../softuiTypes";

export interface SortableCardProps {
  card: CardPlacement;
  className: string;
  children: ReactNode;
  editing?: boolean;
}

export function SortableCard({ card, className, children, editing = false }: SortableCardProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: card.id, disabled: !editing });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <article
      className={`${className} card-layout-item${isDragging ? " is-dragging" : ""}`}
      ref={setNodeRef}
      style={style}
    >
      <div className="card-layout-item-header">
        {children}
        {editing ? (
          <button
            aria-label="移动卡片"
            className="card-icon-button card-drag-handle"
            ref={setActivatorNodeRef}
            type="button"
            {...attributes}
            {...listeners}
          >
            <GripVertical aria-hidden="true" size={16} />
          </button>
        ) : null}
      </div>
    </article>
  );
}

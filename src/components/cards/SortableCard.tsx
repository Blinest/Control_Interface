import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { CardPlacement, CardSize } from "../../softuiTypes";
import { CardResizeHandle } from "./CardResizeHandle";

export interface SortableCardProps {
  card: CardPlacement;
  cardLabel: string;
  className: string;
  children: ReactNode;
  onResize: (size: CardSize) => void;
}

export function SortableCard({ card, cardLabel, className, children, onResize }: SortableCardProps) {
  const {
    attributes,
    isDragging,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: card.id });

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
      {children}
      <div className="card-layout-item-controls">
        <button
          aria-label={`\u79fb\u52a8${cardLabel}\u5361\u7247`}
          className="card-icon-button card-drag-handle"
          ref={setActivatorNodeRef}
          type="button"
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" size={16} />
        </button>
        <CardResizeHandle
          label={`\u62c9\u4f38${cardLabel}\u5361\u7247`}
          onResize={onResize}
          size={card.size}
        />
      </div>
    </article>
  );
}

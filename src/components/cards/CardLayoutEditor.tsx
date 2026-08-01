import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import type React from "react";
import type { CardPlacement, CardSize, PageLayout } from "../../softuiTypes";
import { SortableCard } from "./SortableCard";
import "./cards.css";

export const cardSizeClass: Record<CardSize, string> = {
  "1x1": "card-size-small",
  "2x1": "card-size-wide",
  "1x2": "card-size-tall",
  "2x2": "card-size-large",
};

const cardLabels: Record<CardPlacement["id"], string> = {
  connection: "\u8fde\u63a5\u72b6\u6001",
  sampling: "\u91c7\u6837\u72b6\u6001",
  recording: "\u8bb0\u5f55\u72b6\u6001",
  alerts: "\u544a\u8b66",
  deviceHealth: "\u8bbe\u5907\u5065\u5eb7",
  recentSessions: "\u6700\u8fd1\u4f1a\u8bdd",
  recentEvents: "\u6700\u8fd1\u4e8b\u4ef6",
  liveChart: "\u5b9e\u65f6\u56fe\u8868",
  model3d: "\u4e09\u7ef4\u6a21\u578b",
  deviceState: "\u8bbe\u5907\u72b6\u6001",
  commandQueue: "\u547d\u4ee4\u961f\u5217",
  motorSummary: "\u7535\u673a\u6458\u8981",
  sensorSummary: "\u4f20\u611f\u5668\u6458\u8981",
  recentAlerts: "\u6700\u8fd1\u544a\u8b66",
};

export interface DirectCardLayoutProps {
  layout: PageLayout;
  onLayoutChange: (layout: PageLayout) => void;
  childrenForCard: (card: CardPlacement) => React.ReactNode;
}

export function DirectCardLayout({ layout, onLayoutChange, childrenForCard }: DirectCardLayoutProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 240, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visibleCards = layout.cards.filter((card) => card.visible);

  const updateSize = (cardId: CardPlacement["id"], size: CardSize) => {
    onLayoutChange({
      ...layout,
      cards: layout.cards.map((card) => (card.id === cardId ? { ...card, size } : card)),
    });
  };

  const reorderCards = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    const oldIndex = visibleCards.findIndex((card) => card.id === active.id);
    const newIndex = visibleCards.findIndex((card) => card.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reorderedVisibleCards = arrayMove(visibleCards, oldIndex, newIndex);
    let visibleIndex = 0;
    onLayoutChange({
      ...layout,
      cards: layout.cards.map((card) => (
        card.visible ? reorderedVisibleCards[visibleIndex++] : card
      )),
    });
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={reorderCards} sensors={sensors}>
      <SortableContext items={visibleCards.map((card) => card.id)} strategy={rectSortingStrategy}>
        <div className="card-grid feature-card-grid" aria-label="\u5361\u7247\u5e03\u5c40">
          {visibleCards.map((card) => (
            <SortableCard
              card={card}
              cardLabel={cardLabels[card.id]}
              className={`feature-card ${cardSizeClass[card.size]}`}
              key={card.id}
              onResize={(size) => updateSize(card.id, size)}
            >
              {childrenForCard(card)}
            </SortableCard>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

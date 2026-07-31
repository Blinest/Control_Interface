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
import { RotateCcw } from "lucide-react";
import { useState } from "react";
import type { CardPlacement, CardSize, PageLayout } from "../../softuiTypes";
import { CardResizeHandle } from "./CardResizeHandle";
import { SortableCard } from "./SortableCard";
import "./cards.css";

export const cardSizeClass: Record<CardSize, string> = {
  "1x1": "card-size-small",
  "2x1": "card-size-wide",
  "1x2": "card-size-tall",
  "2x2": "card-size-large",
};

const cardLabels: Record<CardPlacement["id"], string> = {
  connection: "连接状态",
  sampling: "采样状态",
  recording: "记录状态",
  alerts: "告警",
  deviceHealth: "设备健康",
  recentSessions: "最近会话",
  recentEvents: "最近事件",
  liveChart: "实时图表",
  model3d: "三维模型",
  deviceState: "设备状态",
  commandQueue: "命令队列",
  motorSummary: "电机摘要",
  sensorSummary: "传感器摘要",
  recentAlerts: "最近告警",
};

export interface CardLayoutEditorProps {
  layout: PageLayout;
  onSave: (layout: PageLayout) => void;
  onCancel: () => void;
  onReset: () => void;
}

function cloneLayout(layout: PageLayout): PageLayout {
  return { ...layout, cards: layout.cards.map((card) => ({ ...card })) };
}

export function CardLayoutEditor({ layout, onSave, onCancel, onReset }: CardLayoutEditorProps) {
  const [draft, setDraft] = useState(() => cloneLayout(layout));
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateSize = (cardId: CardPlacement["id"], size: CardSize) => {
    setDraft((current) => ({
      ...current,
      cards: current.cards.map((card) => (card.id === cardId ? { ...card, size } : card)),
    }));
  };

  const reorderCards = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;

    setDraft((current) => {
      const oldIndex = current.cards.findIndex((card) => card.id === active.id);
      const newIndex = current.cards.findIndex((card) => card.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;

      return { ...current, cards: arrayMove(current.cards, oldIndex, newIndex) };
    });
  };

  return (
    <section aria-label="编辑卡片布局" className="card-layout-editor">
      <DndContext
        collisionDetection={closestCenter}
        onDragEnd={reorderCards}
        sensors={sensors}
      >
        <SortableContext items={draft.cards.map((card) => card.id)} strategy={rectSortingStrategy}>
          <div className="card-grid">
            {draft.cards.map((card) => {
              const cardLabel = cardLabels[card.id];

              return (
                <SortableCard
                  card={card}
                  className={`card-layout-card ${cardSizeClass[card.size]}`}
                  editing
                  key={card.id}
                >
                  <div className="card-layout-card-title">
                    <h3>{cardLabel}</h3>
                    <CardResizeHandle
                      label={`调整${cardLabel}卡片大小`}
                      onResize={(size) => updateSize(card.id, size)}
                      size={card.size}
                    />
                  </div>
                </SortableCard>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
      <footer className="card-layout-editor-actions">
        <button className="ghost-btn" onClick={onReset} type="button">
          <RotateCcw aria-hidden="true" size={16} />
          重置
        </button>
        <div className="card-layout-editor-primary-actions">
          <button className="ghost-btn" onClick={onCancel} type="button">取消</button>
          <button className="primary-btn" onClick={() => onSave(cloneLayout(draft))} type="button">保存布局</button>
        </div>
      </footer>
    </section>
  );
}

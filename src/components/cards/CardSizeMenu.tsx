import { Maximize2 } from "lucide-react";
import { useId, useState } from "react";
import type { CardSize } from "../../softuiTypes";

const sizeOptions: Array<{ value: CardSize; label: string }> = [
  { value: "1x1", label: "小 1×1" },
  { value: "2x1", label: "宽 2×1" },
  { value: "1x2", label: "高 1×2" },
  { value: "2x2", label: "大 2×2" },
];

export interface CardSizeMenuProps {
  cardLabel: string;
  size: CardSize;
  onChange: (size: CardSize) => void;
}

export function CardSizeMenu({ cardLabel, size, onChange }: CardSizeMenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();

  const selectSize = (nextSize: CardSize) => {
    onChange(nextSize);
    setOpen(false);
  };

  return (
    <div className="card-size-menu">
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`调整${cardLabel}卡片大小`}
        className="card-icon-button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        type="button"
      >
        <Maximize2 aria-hidden="true" size={16} />
      </button>
      {open ? (
        <div aria-label={`${cardLabel}卡片尺寸`} className="card-size-options" id={menuId} role="menu">
          {sizeOptions.map((option) => (
            <button
              aria-current={size === option.value ? "true" : undefined}
              className="card-size-option"
              key={option.value}
              onClick={() => selectSize(option.value)}
              role="menuitem"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

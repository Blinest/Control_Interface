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
        aria-label={`调整${cardLabel}卡片大小`}
        className="card-icon-button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        type="button"
      >
        <Maximize2 aria-hidden="true" size={16} />
      </button>
      {open ? (
        <ul aria-label={`${cardLabel}卡片尺寸`} className="card-size-options" id={menuId}>
          {sizeOptions.map((option) => (
            <li key={option.value}>
              <button
                aria-pressed={size === option.value}
                className="card-size-option"
                onClick={() => selectSize(option.value)}
                type="button"
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

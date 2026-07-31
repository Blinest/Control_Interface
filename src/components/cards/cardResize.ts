import type { CardSize } from "../../softuiTypes";

const THRESHOLD = 24;

export function sizeFromDrag(start: CardSize, dx: number, dy: number): CardSize {
  const wide = dx >= THRESHOLD;
  const tall = dy >= THRESHOLD;
  const shrinkWide = dx <= -THRESHOLD;
  const shrinkTall = dy <= -THRESHOLD;

  if (wide && tall) return "2x2";
  if (wide) return "2x1";
  if (tall) return "1x2";
  if (shrinkWide && shrinkTall) return "1x1";
  if (shrinkWide) return start === "2x2" || start === "2x1" ? "1x1" : start;
  if (shrinkTall) return start === "2x2" || start === "1x2" ? "1x1" : start;
  return start;
}

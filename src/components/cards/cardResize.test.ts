import { describe, expect, it } from "vitest";
import { sizeFromDrag } from "./cardResize";

describe("sizeFromDrag", () => {
  it("maps drag direction to the next discrete size", () => {
    expect(sizeFromDrag("1x1", 40, 20)).toBe("2x1");
    expect(sizeFromDrag("1x1", 20, 40)).toBe("1x2");
    expect(sizeFromDrag("1x1", 40, 40)).toBe("2x2");
  });

  it("shrinks large cards back to one cell", () => {
    expect(sizeFromDrag("2x2", -40, -40)).toBe("1x1");
    expect(sizeFromDrag("2x1", -40, 0)).toBe("1x1");
    expect(sizeFromDrag("1x2", 0, -40)).toBe("1x1");
  });

  it("keeps the current size for small drags", () => {
    expect(sizeFromDrag("1x1", 10, 10)).toBe("1x1");
  });
});

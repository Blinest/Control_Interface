import { describe, expect, it } from "vitest";
import { createSerialRunner } from "./serialRunner";

describe("createSerialRunner", () => {
  it("skips a second refresh while the first is running", async () => {
    const run = createSerialRunner();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const first = run(async () => {
      await gate;
      return "first";
    });
    const second = run(async () => "second");

    release();

    expect(await first).toBe("first");
    expect(await second).toBeUndefined();
  });

  it("runs again after the previous task finishes", async () => {
    const run = createSerialRunner();

    await run(async () => "one");
    const next = await run(async () => "two");

    expect(next).toBe("two");
  });
});

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mojibakePattern } from "../../scripts/mojibake-denylist.mjs";

const checkedRoots = ["src", "scripts", "docs"];
const checkedExtensions = new Set([".css", ".html", ".js", ".jsx", ".md", ".mjs", ".ts", ".tsx"]);

function collectCheckedFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    if (path.replaceAll("\\", "/").includes("src/assets/")) return [];
    const stats = statSync(path);
    if (stats.isDirectory()) return collectCheckedFiles(path);
    if (path.replaceAll("\\", "/").endsWith("scripts/mojibake-denylist.mjs")) return [];
    const extension = path.match(/\.[^.]+$/)?.[0] ?? "";
    return checkedExtensions.has(extension) ? [path] : [];
  });
}

describe("visible Chinese copy", () => {
  it("does not contain mojibake in user-facing source files", () => {
    const offenders = checkedRoots.flatMap(collectCheckedFiles).flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return mojibakePattern.test(text) ? [file] : [];
    });

    expect(offenders).toEqual([]);
  });
});

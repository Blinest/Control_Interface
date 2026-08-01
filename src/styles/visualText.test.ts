import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { mojibakePattern } from "../../scripts/mojibake-denylist.mjs";

const checkedFiles = [
  "src/App.tsx",
  "src/components/feedback/ErrorBoundary.tsx",
  "src/components/cards/CardLayoutEditor.tsx",
  "src/features/dashboard/DashboardPage.tsx",
  "src/features/device-workspace/DeviceWorkspacePage.tsx",
  "src/features/charts/ChartsPage.tsx",
  "src/features/logs/LogsPage.tsx",
  "src/features/sessions/SessionsPage.tsx",
  "src/features/settings/SettingsPage.tsx",
];

describe("visible Chinese copy", () => {
  it("does not contain mojibake in user-facing source files", () => {
    const offenders = checkedFiles.flatMap((file) => {
      const text = readFileSync(file, "utf8");
      return mojibakePattern.test(text) ? [file] : [];
    });

    expect(offenders).toEqual([]);
  });
});

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fixtureSnapshot } from "../../test/fixtures/fixtureSnapshot";
import SettingsPage, { type SettingsPageProps } from "./SettingsPage";

const settingsProps: SettingsPageProps = {
  snapshot: fixtureSnapshot,
  users: [],
  diagnosticsPath: "",
  migrationSource: "",
  migrationPreview: null,
  migrationReport: null,
  onThemePreferenceChange: vi.fn(),
  onExportDiagnostics: vi.fn(),
  onMigrationSourceChange: vi.fn(),
  onPreviewMigration: vi.fn(),
  onRunMigration: vi.fn(),
  onCreateUser: vi.fn(),
  onResetUserPassword: vi.fn(),
  onSetUserDisabled: vi.fn(),
  onResetLayouts: vi.fn(),
};

describe("SettingsPage", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders only the selected settings category", async () => {
    const user = userEvent.setup();
    render(<SettingsPage {...settingsProps} />);

    expect(screen.getByRole("heading", { name: "应用与路径" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "账户与权限" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "账户与权限" }));

    expect(screen.getByRole("heading", { name: "账户与权限" })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "数据迁移" })).not.toBeInTheDocument();
  });
});

import { useState } from "react";
import { SettingsLayout } from "../../layouts/SettingsLayout";
import type { ThemePreference } from "../../state/themeStore";
import type {
  LegacyMigrationPreview,
  LegacyMigrationReport,
  Role,
  RuntimeSnapshot,
  UserAccount,
} from "../../softuiTypes";
import { AccountSettings } from "./AccountSettings";
import { ApplicationSettings } from "./ApplicationSettings";
import { AppearanceSettings } from "./AppearanceSettings";
import { ConnectionSettings } from "./ConnectionSettings";
import { DiagnosticsSettings } from "./DiagnosticsSettings";
import { MigrationSettings } from "./MigrationSettings";
import { SettingsNavigation } from "./SettingsNavigation";
import { settingsSections, type SettingsSection } from "./settingsSections";
import "./settings.css";

export interface SettingsPageProps {
  snapshot: RuntimeSnapshot;
  users: UserAccount[];
  diagnosticsPath: string;
  migrationSource: string;
  migrationPreview: LegacyMigrationPreview | null;
  migrationReport: LegacyMigrationReport | null;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  onExportDiagnostics: () => void;
  onMigrationSourceChange: (value: string) => void;
  onPreviewMigration: () => void;
  onRunMigration: () => void;
  onCreateUser: (username: string, password: string, role: Role) => Promise<void>;
  onResetUserPassword: (username: string, newPassword: string) => Promise<void>;
  onSetUserDisabled: (username: string, disabled: boolean) => Promise<void>;
  onResetLayouts: () => void;
}

export default function SettingsPage({
  snapshot,
  users,
  diagnosticsPath,
  migrationSource,
  migrationPreview,
  migrationReport,
  onThemePreferenceChange,
  onExportDiagnostics,
  onMigrationSourceChange,
  onPreviewMigration,
  onRunMigration,
  onCreateUser,
  onResetUserPassword,
  onSetUserDisabled,
  onResetLayouts,
}: SettingsPageProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("application");
  const activeLabel = settingsSections.find((section) => section.id === activeSection)?.label ?? "";

  return (
    <SettingsLayout
      navigation={<SettingsNavigation active={activeSection} onSelect={setActiveSection} />}
      actions={<div className="settings-actions-label">当前：{activeLabel}</div>}
    >
      {activeSection === "application" ? <ApplicationSettings snapshot={snapshot} /> : null}
      {activeSection === "appearance" ? (
        <AppearanceSettings
          snapshot={snapshot}
          onThemePreferenceChange={onThemePreferenceChange}
          onResetLayouts={onResetLayouts}
        />
      ) : null}
      {activeSection === "connection" ? <ConnectionSettings snapshot={snapshot} /> : null}
      {activeSection === "accounts" ? (
        <AccountSettings
          users={users}
          currentUsername={snapshot.authSession.username}
          canManageUsers={snapshot.authSession.permissions.includes("manageUsers")}
          onCreateUser={onCreateUser}
          onResetUserPassword={onResetUserPassword}
          onSetUserDisabled={onSetUserDisabled}
        />
      ) : null}
      {activeSection === "diagnostics" ? (
        <DiagnosticsSettings diagnosticsPath={diagnosticsPath} onExportDiagnostics={onExportDiagnostics} />
      ) : null}
      {activeSection === "migration" ? (
        <MigrationSettings
          migrationSource={migrationSource}
          migrationPreview={migrationPreview}
          migrationReport={migrationReport}
          onMigrationSourceChange={onMigrationSourceChange}
          onPreviewMigration={onPreviewMigration}
          onRunMigration={onRunMigration}
        />
      ) : null}
    </SettingsLayout>
  );
}

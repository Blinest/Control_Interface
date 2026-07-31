import { Database, Eye } from "lucide-react";
import { ConfirmDialog } from "../../components/feedback/ConfirmDialog";
import { useSafeCommand } from "../device-workspace/useSafeCommand";
import type { LegacyMigrationPreview, LegacyMigrationReport } from "../../softuiTypes";
import "./settings.css";

export interface MigrationSettingsProps {
  migrationSource: string;
  migrationPreview: LegacyMigrationPreview | null;
  migrationReport: LegacyMigrationReport | null;
  onMigrationSourceChange: (value: string) => void;
  onPreviewMigration: () => void;
  onRunMigration: () => void;
}

export function MigrationSettings({
  migrationSource,
  migrationPreview,
  migrationReport,
  onMigrationSourceChange,
  onPreviewMigration,
  onRunMigration,
}: MigrationSettingsProps) {
  const safeCommand = useSafeCommand();
  const migrationTotal = migrationPreview
    ? migrationPreview.userFiles + migrationPreview.configFiles + migrationPreview.csvFiles + migrationPreview.logFiles
    : 0;

  const requestRunMigration = () => {
    void safeCommand.execute("runMigration", { source: migrationSource }, onRunMigration);
  };

  return (
    <section className="settings-section">
      <header>
        <h2>数据迁移</h2>
      </header>
      <label className="settings-field">
        <span>旧版目录</span>
        <input
          type="text"
          value={migrationSource}
          onChange={(event) => onMigrationSourceChange(event.target.value)}
          placeholder="例如 D:\\...\\SoftUI"
        />
      </label>
      <div className="settings-action-row">
        <button type="button" className="ghost-btn" onClick={onPreviewMigration}>
          <Eye size={16} />
          <span>预览</span>
        </button>
        <button
          type="button"
          className="primary-btn"
          onClick={requestRunMigration}
          disabled={!migrationPreview?.exists}
        >
          <Database size={16} />
          <span>执行迁移</span>
        </button>
      </div>
      {migrationPreview ? (
        <div className="migration-summary">
          <div><span>用户</span><strong>{migrationPreview.userFiles}</strong></div>
          <div><span>配置</span><strong>{migrationPreview.configFiles}</strong></div>
          <div><span>CSV</span><strong>{migrationPreview.csvFiles}</strong></div>
          <div><span>日志</span><strong>{migrationPreview.logFiles}</strong></div>
          <div><span>可迁移</span><strong>{migrationTotal}</strong></div>
          <div><span>跳过</span><strong>{migrationPreview.skippedFiles}</strong></div>
        </div>
      ) : null}
      {migrationPreview?.warnings.length ? (
        <div className="settings-warning">
          {migrationPreview.warnings.slice(0, 3).map((warning) => (
            <span key={warning}>{warning}</span>
          ))}
        </div>
      ) : null}
      {migrationReport ? <p className="settings-note">报告：{migrationReport.reportPath}</p> : null}
      <ConfirmDialog
        open={safeCommand.confirmation !== null}
        title={safeCommand.confirmation?.title ?? ""}
        details={safeCommand.confirmation?.details ?? []}
        confirmLabel={safeCommand.confirmation?.confirmLabel ?? ""}
        level={safeCommand.confirmation?.level ?? "warning"}
        onConfirm={() => void safeCommand.confirm()}
        onCancel={safeCommand.cancel}
      />
    </section>
  );
}

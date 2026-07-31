import { Cpu } from "lucide-react";
import { PathValue } from "../../components/data/PathValue";
import "./settings.css";

export interface DiagnosticsSettingsProps {
  diagnosticsPath: string;
  onExportDiagnostics: () => void;
}

export function DiagnosticsSettings({ diagnosticsPath, onExportDiagnostics }: DiagnosticsSettingsProps) {
  return (
    <section className="settings-section">
      <header>
        <h2>日志与诊断</h2>
      </header>
      <button type="button" className="ghost-btn" onClick={onExportDiagnostics}>
        <Cpu size={16} />
        <span>导出诊断包</span>
      </button>
      {diagnosticsPath ? (
        <div className="settings-result">
          <PathValue value={diagnosticsPath} />
        </div>
      ) : (
        <p className="settings-note">尚未导出诊断包。</p>
      )}
    </section>
  );
}

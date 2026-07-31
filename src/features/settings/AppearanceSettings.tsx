import { useState } from "react";
import { readThemePreference, type ThemePreference } from "../../state/themeStore";
import type { RuntimeSnapshot } from "../../softuiTypes";
import "./settings.css";

export interface AppearanceSettingsProps {
  snapshot: RuntimeSnapshot;
  onThemePreferenceChange: (preference: ThemePreference) => void;
  onResetLayouts: () => void;
}

export function AppearanceSettings({
  snapshot,
  onThemePreferenceChange,
  onResetLayouts,
}: AppearanceSettingsProps) {
  const [preference, setPreference] = useState<ThemePreference>(() =>
    readThemePreference(snapshot.authSession.username),
  );

  return (
    <section className="settings-section">
      <header>
        <h2>外观与布局</h2>
      </header>
      <label className="settings-field">
        <span>主题偏好</span>
        <select
          value={preference}
          onChange={(event) => {
            const next = event.target.value as ThemePreference;
            setPreference(next);
            onThemePreferenceChange(next);
          }}
        >
          <option value="system">跟随系统</option>
          <option value="light">浅色</option>
          <option value="dark">深色</option>
        </select>
      </label>
      <div className="settings-kv-grid">
        <div>
          <span>当前主题</span>
          <strong>{snapshot.settings.theme}</strong>
        </div>
        <div>
          <span>界面密度</span>
          <strong>{snapshot.settings.workspaceDensity}</strong>
        </div>
      </div>
      <button type="button" className="ghost-btn" onClick={onResetLayouts}>
        重置卡片布局
      </button>
    </section>
  );
}

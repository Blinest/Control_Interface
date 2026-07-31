import { settingsSections, type SettingsSection } from "./settingsSections";
import "./settings.css";

export interface SettingsNavigationProps {
  active: SettingsSection;
  onSelect: (section: SettingsSection) => void;
}

export function SettingsNavigation({ active, onSelect }: SettingsNavigationProps) {
  return (
    <div className="settings-navigation-tabs" role="tablist" aria-label="设置分类">
      {settingsSections.map((section) => (
        <button
          type="button"
          key={section.id}
          role="tab"
          aria-selected={active === section.id}
          className={`settings-nav-item ${active === section.id ? "active" : ""}`}
          onClick={() => onSelect(section.id)}
        >
          {section.label}
        </button>
      ))}
    </div>
  );
}

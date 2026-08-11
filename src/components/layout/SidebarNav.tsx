import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavLink } from "react-router-dom";
import { navigationGroups } from "../../app/navigation";

interface SidebarNavProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function SidebarNav({ collapsed, onToggleCollapsed }: SidebarNavProps) {
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    <aside className={`app-sidebar${collapsed ? " is-collapsed" : ""}`} aria-label="主导航">
      <div className="sidebar-brand">
        <span>SoftUI</span>
        <button
          aria-label={collapsed ? "展开主导航" : "收起主导航"}
          className="sidebar-collapse-button"
          onClick={onToggleCollapsed}
          title={collapsed ? "展开主导航" : "收起主导航"}
          type="button"
        >
          <ToggleIcon aria-hidden="true" size={17} />
        </button>
      </div>
      <nav className="sidebar-nav">
        {navigationGroups.map((group) => (
          <section className="sidebar-nav-group" key={group.label} aria-label={group.label}>
            <h2>{group.label}</h2>
            {group.items.map(({ icon: Icon, key, label, path }) => (
              <NavLink
                className={({ isActive }) => `sidebar-nav-link${isActive ? " is-active" : ""}`}
                key={key}
                title={label}
                to={path}
              >
                <Icon aria-hidden="true" size={18} />
                <span>{label}</span>
              </NavLink>
            ))}
          </section>
        ))}
      </nav>
    </aside>
  );
}

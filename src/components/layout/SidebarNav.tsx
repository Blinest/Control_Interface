import { NavLink } from "react-router-dom";
import { navigationGroups } from "../../app/navigation";

export function SidebarNav() {
  return (
    <aside className="app-sidebar" aria-label="主导航">
      <div className="sidebar-brand">SoftUI</div>
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

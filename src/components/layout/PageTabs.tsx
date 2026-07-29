import { NavLink } from "react-router-dom";
import { navigationGroups, type NavigationItem } from "../../app/navigation";

const pageTabs = navigationGroups.flatMap(({ items }): NavigationItem[] => [...items]);

export function PageTabs() {
  return (
    <nav className="page-tabs" aria-label="页面标签">
      {pageTabs.map(({ key, label, path }) => (
        <NavLink
          className={({ isActive }) => `page-tab${isActive ? " is-active" : ""}`}
          key={key}
          to={path}
        >
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

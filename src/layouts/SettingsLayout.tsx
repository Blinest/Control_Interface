import type * as React from "react";
import "../styles/layouts.css";

export interface SettingsLayoutProps {
  navigation: React.ReactNode;
  actions: React.ReactNode;
  children: React.ReactNode;
}

export function SettingsLayout({ navigation, actions, children }: SettingsLayoutProps) {
  return (
    <section className="settings-layout">
      <aside className="settings-navigation">{navigation}</aside>
      <header className="settings-actions">{actions}</header>
      <main className="layout-scroll-region">{children}</main>
    </section>
  );
}

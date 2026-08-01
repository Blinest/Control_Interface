import type * as React from "react";
import { ResponsiveRail } from "../components/layout/ResponsiveRail";
import "../styles/layouts.css";

export interface SettingsLayoutProps {
  navigation: React.ReactNode;
  actions: React.ReactNode;
  children: React.ReactNode;
}

export function SettingsLayout({ navigation, actions, children }: SettingsLayoutProps) {
  return (
    <section className="settings-layout">
      <ResponsiveRail className="settings-navigation" label="Settings navigation">
        {navigation}
      </ResponsiveRail>
      <header className="settings-actions">{actions}</header>
      <main className="layout-scroll-region">{children}</main>
    </section>
  );
}

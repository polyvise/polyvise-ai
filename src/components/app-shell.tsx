"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { CORE_VERSION, MODEL_COUNT } from "@/lib/build-info";

type NavItem = {
  href: Route;
  label: string;
  /** Path prefixes that also count as this item being active. */
  match: string[];
};

/**
 * Four destinations. Everything a first-time visitor needs is behind "Ask";
 * the engine's own surfaces (telemetry, the design system) live in the footer.
 */
const nav: NavItem[] = [
  { href: "/" as Route, label: "Ask", match: [] },
  { href: "/runs" as Route, label: "Your runs", match: ["/runs"] },
  { href: "/modes" as Route, label: "Modes", match: ["/modes", "/debate", "/consensus", "/panel"] },
  { href: "/lab" as Route, label: "Models", match: ["/lab"] }
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9.5" className="s-pro" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="5.2" className="s-con" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="1.8" className="f-judge" />
    </svg>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const onHome = pathname === "/";

  return (
    <div className="app">
      <header className="topbar">
        <Link href={"/" as Route} className="brand">
          <BrandMark />
          <span className="brand-name">Polyvise</span>
        </Link>

        <nav className="topnav" aria-label="Primary">
          {nav.map((item) => {
            const active = isActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${active ? " active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="topbar-actions">
          <ThemeToggle />
          {onHome ? (
            <Link href={"/lab" as Route} className="status-pill">
              <span className="status-dot" />
              {MODEL_COUNT} models ready
            </Link>
          ) : (
            <Link href={"/" as Route} className="btn btn-ink">
              New question
            </Link>
          )}
        </div>
      </header>

      <div className="main">{children}</div>

      <footer className="site-foot">
        <span className="row gap8">
          <span className="status-dot" />
          polyvise-core v{CORE_VERSION}
        </span>
        <Link href={"/telemetry" as Route}>Telemetry</Link>
        <Link href={"/system" as Route}>Design system</Link>
        <span className="push">Every claim links to a source. Every step names its model.</span>
      </footer>
    </div>
  );
}

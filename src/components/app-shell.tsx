"use client";

import Link from "next/link";
import Image from "next/image";
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
  { href: "/" as Route, label: "Workspace", match: [] },
  { href: "/runs" as Route, label: "Your runs", match: ["/runs"] },
  { href: "/modes" as Route, label: "Mode guide", match: ["/modes", "/debate", "/consensus", "/panel"] },
  { href: "/lab" as Route, label: "Model lab", match: ["/lab"] }
];

function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  return item.match.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <span className="mark" style={{ width: size, height: size * 0.75 }} aria-hidden="true">
      <Image
        className="brand-art"
        src="/polyvise-logo.png"
        alt=""
        width={Math.round(size * 1.45)}
        height={Math.round(size * 1.45)}
        loading="eager"
      />
    </span>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const onHome = pathname === "/";

  return (
    <div className="app">
      <a href="#main-content" className="skip-link">Skip to content</a>
      <header className="topbar">
        <Link href={"/" as Route} className="brand" aria-label="Polyvise AI home">
          <BrandMark />
          <span className="brand-name">Polyvise AI</span>
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
              {MODEL_COUNT} models in catalog
            </Link>
          ) : (
            <Link href={"/" as Route} className="btn btn-ink">
              New question
            </Link>
          )}
        </div>
      </header>

      <main id="main-content" className="main">{children}</main>

      <footer className="site-foot">
        <span className="row gap8">
          <span className="status-dot" />
          polyvise-core v{CORE_VERSION}
        </span>
        <Link href={"/telemetry" as Route}>Telemetry</Link>
        <Link href={"/system" as Route}>Design system</Link>
      </footer>
    </div>
  );
}

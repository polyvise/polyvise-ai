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
  icon: ReactNode;
  tag?: { text: string; live?: boolean };
  /** Also treat these path prefixes as this item being active. */
  match?: string[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const icon = (children: ReactNode) => (
  <svg className="ico" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}>
    {children}
  </svg>
);

const navGroups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      {
        href: "/",
        label: "Overview",
        icon: icon(
          <>
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="9" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="9" width="5" height="5" rx="1" />
            <rect x="9" y="9" width="5" height="5" rx="1" />
          </>
        )
      },
      {
        href: "/compose",
        label: "New run",
        icon: icon(<path d="M8 3v10M3 8h10" strokeLinecap="round" />)
      },
      {
        href: "/runs",
        label: "Run history",
        icon: icon(<path d="M2.5 4h11M2.5 8h11M2.5 12h7" strokeLinecap="round" />),
        match: ["/runs"]
      }
    ]
  },
  {
    label: "Deliberation modes",
    items: [
      {
        href: "/debate",
        label: "Debate",
        tag: { text: "Live", live: true },
        icon: icon(<path d="M2 5h5v4H4l-2 2V5zM9 7h5v4h-3l-2 2V7z" strokeLinejoin="round" />)
      },
      {
        href: "/consensus",
        label: "Consensus",
        tag: { text: "Next" },
        icon: icon(
          <>
            <circle cx="6" cy="8" r="3.4" />
            <circle cx="10" cy="8" r="3.4" />
          </>
        )
      },
      {
        href: "/panel",
        label: "Advisory panel",
        tag: { text: "Next" },
        icon: icon(
          <>
            <circle cx="8" cy="5" r="2.2" />
            <path d="M3.2 13a4.8 4.8 0 019.6 0" strokeLinecap="round" />
          </>
        )
      },
      {
        href: "/lab",
        label: "Model lab",
        icon: icon(
          <path
            d="M6.5 2v4.2L3 12.2a1.4 1.4 0 001.2 2.1h7.6a1.4 1.4 0 001.2-2.1L9.5 6.2V2M5.5 2h5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      }
    ]
  },
  {
    label: "System",
    items: [
      {
        href: "/telemetry",
        label: "Telemetry",
        icon: icon(<path d="M2 11l3.2-4 2.6 2.4L13.8 4" strokeLinecap="round" strokeLinejoin="round" />)
      },
      {
        href: "/system",
        label: "Design system",
        icon: icon(
          <>
            <circle cx="8" cy="8" r="2.2" />
            <path d="M8 1.6v2M8 12.4v2M1.6 8h2M12.4 8h2" />
          </>
        )
      }
    ]
  }
];

const crumbLabels: Record<string, string> = {
  "/": "overview",
  "/compose": "new run",
  "/runs": "run history",
  "/debate": "debate",
  "/consensus": "consensus",
  "/panel": "advisory panel",
  "/lab": "model lab",
  "/telemetry": "telemetry",
  "/system": "design system"
};

function isActive(item: NavItem, pathname: string): boolean {
  if (item.href === "/") return pathname === "/";
  if (pathname === item.href) return true;
  return (item.match ?? []).some((prefix) => pathname.startsWith(`${prefix}/`));
}

function crumbFor(pathname: string): string {
  if (crumbLabels[pathname]) return crumbLabels[pathname];
  if (pathname.startsWith("/runs/")) {
    return `debate / run ${pathname.slice("/runs/".length).replace(/^debate_/, "")}`;
  }
  return pathname.replace(/^\//, "");
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";

  return (
    <div className="app">
      <aside className="rail">
        <Link href={"/" as Route} className="brand">
          <svg className="mark" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9.2" className="s-pro" strokeWidth="1.3" opacity=".85" />
            <circle cx="12" cy="12" r="4.6" className="s-con" strokeWidth="1.3" opacity=".85" />
            <circle cx="12" cy="12" r="1.5" className="f-judge" />
          </svg>
          <span className="brand-name">Polyvise</span>
        </Link>

        <nav aria-label="Primary">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map((item) => {
                const active = isActive(item, pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item${active ? " active" : ""}`}
                    aria-current={active ? "page" : undefined}
                  >
                    {item.icon}
                    {item.label}
                    {item.tag ? (
                      <span className={`tag${item.tag.live ? " live" : " soon"}`}>{item.tag.text}</span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="rail-foot">
          <div className="row gap8">
            <span className="status-dot" />
            <span className="meta">
              polyvise-core v{CORE_VERSION} · {MODEL_COUNT} models
            </span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <span className="crumb">
            polyvise <b>/ {crumbFor(pathname)}</b>
          </span>
          <div className="topbar-actions">
            <ThemeToggle />
            <Link href={"/compose" as Route} className="btn btn-sm">
              New run
            </Link>
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}

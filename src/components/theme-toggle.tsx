"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const sun = (
  <>
    <circle cx="10" cy="10" r="3.6" />
    <path
      d="M10 2v2M10 16v2M2 10h2M16 10h2M4.4 4.4l1.4 1.4M14.2 14.2l1.4 1.4M15.6 4.4l-1.4 1.4M5.8 14.2l-1.4 1.4"
      strokeLinecap="round"
    />
  </>
);

const moon = <path d="M16.5 12.2A7 7 0 0 1 7.8 3.5a7 7 0 1 0 8.7 8.7Z" strokeLinejoin="round" />;

export function ThemeToggle() {
  // The inline script in the document head has already resolved the theme;
  // this picks up whatever it decided rather than guessing a second time.
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "light" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("polyvise-theme", next);
    } catch {
      // a blocked localStorage shouldn't break the toggle
    }
    setTheme(next);
  }

  return (
    <button
      type="button"
      className="theme-btn"
      onClick={toggle}
      title="Switch theme"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.6}>
        {theme === "light" ? moon : sun}
      </svg>
    </button>
  );
}

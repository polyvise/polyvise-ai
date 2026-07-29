"use client";

import { useEffect, useState } from "react";

type Theme = "dark" | "light";

const sun = (
  <>
    <circle cx="8" cy="8" r="3.1" />
    <path
      d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6M3.5 3.5l1.1 1.1M11.4 11.4l1.1 1.1M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1"
      strokeLinecap="round"
    />
  </>
);

const moon = <path d="M13.2 9.6A5.6 5.6 0 016.4 2.8a5.8 5.8 0 106.8 6.8z" strokeLinejoin="round" />;

export function ThemeToggle() {
  // The inline script in the document head has already resolved the theme;
  // this picks up whatever it decided rather than guessing a second time.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "light" ? "light" : "dark");
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
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4}>
        {theme === "light" ? moon : sun}
      </svg>
    </button>
  );
}

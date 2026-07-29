import type { Config } from "tailwindcss";

/**
 * Tailwind's palette resolves through the same CSS variables as the design
 * system in globals.css, so a utility class and a component class can never
 * disagree about what "pro" means — and both repaint on a theme switch.
 */
const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        sunken: "var(--sunken)",
        ivory: "var(--ivory)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        line: "var(--line)",
        pro: "var(--pro)",
        con: "var(--con)",
        judge: "var(--judge)",
        alert: "var(--alert)"
      },
      fontFamily: {
        display: "var(--display)",
        ui: "var(--ui)",
        mono: "var(--mono)"
      }
    }
  },
  plugins: [require("@tailwindcss/typography")]
};

export default config;

import { permanentRedirect } from "next/navigation";

/**
 * The engine-health dashboard now lives at /telemetry, where it sits in the
 * System group of the rail alongside the design system. This keeps the old
 * public link working.
 */
export default function StatsPage() {
  permanentRedirect("/telemetry");
}

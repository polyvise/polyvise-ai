import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { YourRuns } from "@/components/your-runs";
import { formatCost } from "@/lib/run-view";
import { getPublicStats, type PublicStats } from "@/server/stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Run history | Polyvise",
  description: "Your own runs, plus anonymous totals across the workspace."
};

export default async function RunsPage() {
  let stats: PublicStats | null = null;
  try {
    stats = await getPublicStats();
  } catch (error) {
    console.error("Unable to load run totals", error);
  }

  return (
    <section className="page">
      <span className="eyebrow">Run history</span>
      <h2 className="display d2 mt10">Your runs</h2>
      <p className="lede mt10 mw640">
        Polyvise has no accounts, so this list lives in your browser. Everyone else&apos;s questions stay private —
        the totals below are the only thing shared, and they never include a topic.
      </p>

      <YourRuns />

      <div className="mt44">
        <div className="section-head">
          <div>
            <span className="eyebrow">Across the workspace</span>
            <h3 className="display d3 mt6">Anonymous totals</h3>
          </div>
          <span className="small">
            <Link href={"/telemetry" as Route} style={{ color: "var(--pro)" }}>
              Full engine health →
            </Link>
          </span>
        </div>

        {!stats ? (
          <div className="card card-pad">
            <p className="small">Totals are temporarily unavailable.</p>
          </div>
        ) : (
          <div className="stat-strip" style={{ marginTop: 0 }}>
            <Stat value={String(stats.totalDebates)} label={stats.totalDebates === 1 ? "run recorded" : "runs recorded"} />
            <Stat value={`${Math.round(stats.completionRate * 100)}%`} label="completed" />
            <Stat value={String(stats.recent7Days)} label="in the last 7 days" />
            <Stat value={formatCost(stats.estimatedCostUsd)} label="estimated spend" />
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <div className="stat-v">{value}</div>
      <div className="stat-k meta">{label}</div>
    </div>
  );
}

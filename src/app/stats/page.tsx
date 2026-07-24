import type { Metadata } from "next";
import Link from "next/link";
import { Activity, ArrowLeft, Database, Gauge, Layers3, MessageSquare } from "lucide-react";
import { getPublicStats, type PublicStats } from "@/server/stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "System activity | Polyvise",
  description: "Aggregate Polyvise debate activity, model usage, and output statistics."
};

export default async function StatsPage() {
  let stats: PublicStats | null = null;
  let unavailable = false;

  try {
    stats = await getPublicStats();
  } catch (error) {
    unavailable = true;
    console.error("Unable to load Polyvise stats", error);
  }

  return (
    <main className="min-h-screen bg-paper px-5 py-8 text-ink sm:py-12">
      <div className="mx-auto max-w-[1180px]">
        <header className="mb-10 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tight text-ink">polyvise</Link>
          <Link href="/" className="inline-flex items-center gap-2 text-xs font-medium text-graphite/70 transition hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" />
            Debate workspace
          </Link>
        </header>

        <section className="mb-8 border-b border-graphite/10 pb-8">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-jade">
            <Activity className="h-4 w-4" />
            System activity
          </div>
          <h1 className="max-w-3xl text-3xl font-semibold tracking-tight sm:text-5xl">
            A clear view of Polyvise usage.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-graphite/65">
            Aggregated operational statistics from Firestore. Debate topics, context,
            follow-up text, and feedback messages are never displayed here.
          </p>
        </section>

        {unavailable || !stats ? (
          <section className="rounded-lg border border-coral/20 bg-white p-8 shadow-panel">
            <h2 className="font-semibold">Statistics are temporarily unavailable.</h2>
            <p className="mt-2 text-sm text-graphite/60">The debate workspace is unaffected.</p>
          </section>
        ) : (
          <StatsContent stats={stats} />
        )}
      </div>
    </main>
  );
}

function StatsContent({ stats }: { stats: PublicStats }) {
  const maxDaily = Math.max(1, ...stats.dailyActivity.map((day) => day.count));
  const maxStatus = Math.max(1, ...stats.statusBreakdown.map((item) => item.count));
  const maxModel = Math.max(1, ...stats.modelUsage.map((item) => item.debates));

  return (
    <div className="space-y-6">
      <section className="grid gap-px overflow-hidden rounded-lg border border-graphite/10 bg-graphite/10 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Total debates" value={formatNumber(stats.totalDebates)} icon={<Layers3 className="h-4 w-4" />} />
        <Metric label="Completion rate" value={`${Math.round(stats.completionRate * 100)}%`} detail={`${formatNumber(stats.completedDebates)} completed`} icon={<Gauge className="h-4 w-4" />} />
        <Metric label="Last 7 days" value={formatNumber(stats.recent7Days)} detail={`${formatNumber(stats.recent30Days)} in 30 days`} icon={<Activity className="h-4 w-4" />} />
        <Metric label="Feedback entries" value={formatNumber(stats.feedbackCount)} icon={<MessageSquare className="h-4 w-4" />} />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <Panel title="Debate activity" subtitle="New debates over the last 14 days">
          <div className="flex h-56 items-end gap-1.5 pt-6 sm:gap-3">
            {stats.dailyActivity.map((day, index) => (
              <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10px] font-medium text-graphite/60">{day.count || ""}</span>
                <div
                  className="w-full min-w-2 rounded-t-sm bg-jade transition-all"
                  style={{ height: `${Math.max(day.count ? 10 : 2, (day.count / maxDaily) * 160)}px`, opacity: day.count ? 1 : 0.15 }}
                  title={`${day.label}: ${day.count}`}
                />
                <span className="hidden text-[9px] text-graphite/45 sm:block">{index % 2 === 0 ? day.label : ""}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Run status" subtitle={`${stats.activeDebates} debates currently active`}>
          <div className="space-y-3.5">
            {stats.statusBreakdown.map((item) => (
              <BarRow key={item.status} label={statusLabel(item.status)} value={item.count} width={(item.count / maxStatus) * 100} color="bg-coral" />
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Panel title="Model usage" subtitle="Number of debates in which each model participated">
          {stats.modelUsage.length ? (
            <div className="space-y-3.5">
              {stats.modelUsage.map((item) => (
                <BarRow key={item.model} label={item.model} value={item.debates} width={(item.debates / maxModel) * 100} color="bg-jade" />
              ))}
            </div>
          ) : (
            <p className="rounded-md bg-linen/60 p-5 text-sm text-graphite/55">No model runs recorded yet.</p>
          )}
        </Panel>

        <Panel title="Aggregate output" subtitle="Counts across persisted debate runs">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-graphite/10 bg-graphite/10">
            <SmallMetric label="Evidence sources" value={stats.totalSources} />
            <SmallMetric label="Debate turns" value={stats.totalTurns} />
            <SmallMetric label="Follow-up answers" value={stats.totalFollowups} />
            <SmallMetric label="Model tokens" value={stats.promptTokens + stats.completionTokens} />
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-md bg-linen/60 px-4 py-3 text-xs text-graphite/65">
            <Database className="h-4 w-4 shrink-0 text-jade" />
            Aggregate counts from polyvise.ai&apos;s isolated Firestore collections
          </div>
        </Panel>
      </section>

      <p className="pb-4 text-center text-[11px] text-graphite/45">
        {stats.lastUpdatedAt
          ? `Latest activity ${new Date(stats.lastUpdatedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`
          : "No debate activity recorded yet"}
      </p>
    </div>
  );
}

function Metric({ label, value, detail, icon }: { label: string; value: string; detail?: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white p-5 sm:p-6">
      <div className="mb-5 text-jade">{icon}</div>
      <div className="text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-sm font-medium text-graphite">{label}</div>
      {detail ? <div className="mt-1 text-xs text-graphite/50">{detail}</div> : null}
    </div>
  );
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-graphite/10 bg-white p-5 shadow-panel sm:p-6">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mb-6 mt-1 text-xs text-graphite/50">{subtitle}</p>
      {children}
    </section>
  );
}

function BarRow({ label, value, width, color }: { label: string; value: number; width: number; color: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-4 text-xs">
        <span className="truncate text-graphite/75" title={label}>{label}</span>
        <span className="font-medium text-ink">{formatNumber(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-linen">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function SmallMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-paper p-4">
      <div className="text-2xl font-semibold tracking-tight">{formatNumber(value)}</div>
      <div className="mt-1 text-xs text-graphite/55">{label}</div>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { notation: value >= 10_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(value);
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

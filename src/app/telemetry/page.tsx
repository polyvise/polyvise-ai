import type { Metadata } from "next";
import { formatCost } from "@/lib/run-view";
import { getPublicStats, type PublicStats } from "@/server/stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Telemetry | Polyvise",
  description: "Engine health: run volume, step reliability, retries and spend."
};

export default async function TelemetryPage() {
  let stats: PublicStats | null = null;

  try {
    stats = await getPublicStats();
  } catch (error) {
    console.error("Unable to load Polyvise stats", error);
  }

  return (
    <section className="page">
      <span className="eyebrow">Telemetry</span>
      <h2 className="display d2 mt10">Engine health</h2>
      <p className="lede mt10 mw640">
        Aggregate operational figures across every persisted run. Debate topics, context, follow-up text and feedback
        messages are never shown here.
      </p>

      {!stats ? (
        <div className="card card-pad mt24">
          <h4 className="card-title">Statistics are temporarily unavailable.</h4>
          <p className="small mt6">Starting and viewing runs is unaffected.</p>
        </div>
      ) : (
        <TelemetryContent stats={stats} />
      )}
    </section>
  );
}

function TelemetryContent({ stats }: { stats: PublicStats }) {
  const retriesPerRun = stats.totalDebates ? stats.totalRetries / stats.totalDebates : 0;
  const maxDaily = Math.max(1, ...stats.dailyActivity.map((day) => day.count));
  const maxStatus = Math.max(1, ...stats.statusBreakdown.map((item) => item.count));
  const maxModel = Math.max(1, ...stats.modelUsage.map((item) => item.debates));

  return (
    <>
      <div className="stat-strip mt22">
        <Stat value={String(stats.recent7Days)} label="runs in the last 7 days" />
        <Stat value={`${Math.round(stats.fallbackFreeRate * 100)}%`} label="completed without a fallback" />
        <Stat value={retriesPerRun.toFixed(1)} label="average retries per run" />
        <Stat value={formatCost(stats.estimatedCostUsd)} label="estimated spend, all time" />
      </div>

      <div className="card mt18">
        <div className="card-head">
          <span className="card-title">Step reliability</span>
          <span className="meta push">{stats.totalModelCalls} recorded model calls</span>
        </div>
        <div className="card-pad">
          {stats.stepReliability.map((step) => {
            const okShare = step.calls ? Math.round(((step.calls - step.fallbacks) / step.calls) * 100) : 0;
            return (
              <div className="score-row" key={step.step}>
                <span className="score-name">{step.label}</span>
                <div className="score-bars">
                  {step.calls === 0 ? (
                    <div className="sb" style={{ width: "100%", background: "var(--track)" }} />
                  ) : (
                    <>
                      <div className="sb sb-pro" style={{ width: `${okShare}%` }} />
                      {step.fallbacks > 0 ? <div className="sb sb-alert" style={{ width: `${100 - okShare}%` }} /> : null}
                    </>
                  )}
                </div>
                <span className="score-note">
                  {step.calls === 0
                    ? "no calls recorded"
                    : `${okShare}% ok · ${step.fallbacks} fell back · ${step.retries} retries`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid g2 mt18">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Run volume</span>
            <span className="meta push">last 14 days</span>
          </div>
          <div className="card-pad">
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 168 }}>
              {stats.dailyActivity.map((day) => (
                <div
                  key={day.date}
                  style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}
                  title={`${day.label}: ${day.count}`}
                >
                  <span className="meta">{day.count || ""}</span>
                  <div
                    style={{
                      width: "100%",
                      height: `${Math.max(day.count ? 8 : 2, (day.count / maxDaily) * 120)}px`,
                      borderRadius: "2px 2px 0 0",
                      background: day.count ? "var(--pro)" : "var(--track)"
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="row mt10" style={{ justifyContent: "space-between" }}>
              <span className="meta">{stats.dailyActivity[0]?.label}</span>
              <span className="meta">{stats.dailyActivity[stats.dailyActivity.length - 1]?.label}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Run status</span>
            <span className="meta push">{stats.activeDebates} active</span>
          </div>
          <div className="card-pad">
            {stats.statusBreakdown.map((item) => (
              <div className="score-row" key={item.status}>
                <span className="score-name">{item.status}</span>
                <div className="score-bars">
                  <div
                    className={`sb ${item.status === "failed" ? "sb-alert" : "sb-pro"}`}
                    style={{ width: `${Math.max(item.count ? 4 : 0, (item.count / maxStatus) * 100)}%` }}
                  />
                </div>
                <span className="score-note">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid g2 mt18">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Model usage</span>
            <span className="meta push">runs each model took part in</span>
          </div>
          <div className="card-pad">
            {stats.modelUsage.length === 0 ? (
              <p className="small">No model runs recorded yet.</p>
            ) : (
              stats.modelUsage.map((item) => (
                <div className="score-row" key={item.model}>
                  <span className="score-name" style={{ width: 180 }}>
                    <code>{item.model}</code>
                  </span>
                  <div className="score-bars">
                    <div className="sb sb-pro" style={{ width: `${(item.debates / maxModel) * 100}%` }} />
                  </div>
                  <span className="score-note">{item.debates}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Aggregate output</span>
            <span className="meta push">across persisted runs</span>
          </div>
          <div className="card-pad">
            <InsRow k="Total runs" v={String(stats.totalDebates)} />
            <InsRow k="Completed" v={`${stats.completedDebates} · ${Math.round(stats.completionRate * 100)}%`} />
            <InsRow k="Evidence sources" v={String(stats.totalSources)} />
            <InsRow k="Debate turns" v={String(stats.totalTurns)} />
            <InsRow k="Follow-up answers" v={String(stats.totalFollowups)} />
            <InsRow k="Model tokens" v={String(stats.promptTokens + stats.completionTokens)} />
            <InsRow k="Feedback entries" v={String(stats.feedbackCount)} />
          </div>
        </div>
      </div>

      <p className="meta mt18">
        {stats.lastUpdatedAt
          ? `Latest activity ${new Date(stats.lastUpdatedAt).toISOString().replace("T", " ").slice(0, 16)} UTC`
          : "No debate activity recorded yet"}
      </p>
    </>
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

function InsRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="ins-row">
      <span className="k">{k}</span>
      <span className="v">{v}</span>
    </div>
  );
}

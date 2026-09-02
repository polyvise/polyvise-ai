"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ArgumentMap } from "@/components/argument-map";
import {
  formatCost,
  formatLatency,
  formatRecommendation,
  formatTokens,
  groupTurnsByRound,
  initialStateFromRecord,
  isRosterSnapshot,
  recommendationTone,
  roundLabels,
  roundOrder,
  runViewReducer,
  sourceRef,
  stageLabel,
  stepLabels,
  type RunViewState,
  type StepId
} from "@/lib/run-view";
import type {
  DebateLiveEvent,
  DebateRecord,
  DebateRound,
  DebateStatus,
  EvidenceSource,
  ModelSnapshot,
  PlaceholderInfo,
  RoundTurn
} from "@polyvise/core/debate/types";

type TabId = "floor" | "verdict" | "evidence" | "graph" | "telemetry";

const eventKinds: DebateLiveEvent["kind"][] = [
  "stage",
  "framed",
  "scouts",
  "teams",
  "sources",
  "claims",
  "argument_map",
  "turns",
  "scorecard",
  "summary",
  "model_snapshot",
  "complete",
  "error"
];

const stages: { id: DebateStatus; label: string }[] = [
  { id: "framing", label: "Framing" },
  { id: "researching", label: "Research" },
  { id: "debating", label: "Debate" },
  { id: "judging", label: "Judging" },
  { id: "complete", label: "Verdict" }
];

export function RunSurface({ record }: { record: DebateRecord }) {
  const router = useRouter();
  const [state, dispatch] = useReducer(runViewReducer, record, initialStateFromRecord);
  // A finished run opens on its verdict; one still in flight opens on the floor.
  const [tab, setTab] = useState<TabId>(record.status === "complete" ? "verdict" : "floor");
  const eventSourceRef = useRef<EventSource | null>(null);
  const recordStamp = record.updatedAt;

  // Re-seed from the server record whenever it changes underneath us (after a
  // router.refresh() once the run lands, or after a follow-up is answered).
  useEffect(() => {
    dispatch({ type: "hydrate", record });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordStamp]);

  const isTerminal = record.status === "complete" || record.status === "failed";

  useEffect(() => {
    if (isTerminal) return;

    const source = new EventSource(`/api/debates/${record.id}/events`);
    eventSourceRef.current = source;

    for (const kind of eventKinds) {
      source.addEventListener(kind, (message) => {
        try {
          dispatch({ type: "event", event: JSON.parse((message as MessageEvent).data) as DebateLiveEvent });
        } catch {
          // ignore malformed events
        }
      });
    }

    const finish = () => {
      source.close();
      eventSourceRef.current = null;
      router.refresh();
    };

    source.addEventListener("complete", finish);
    source.addEventListener("closed", finish);
    source.addEventListener("error", finish);

    return () => {
      source.close();
      eventSourceRef.current = null;
    };
  }, [record.id, isTerminal, router]);

  // The engine records the shape it ran from core 0.3.4 on; older runs only
  // reveal it through the lineup.
  const recordedSize = record.latestRun?.councilSize;
  const councilSize =
    recordedSize === "duo" || (!recordedSize && state.teams && state.teams.pro.length === 1)
      ? "Duo"
      : "Quartet";
  // Slot placeholders aren't calls — see isRosterSnapshot.
  const calls = useMemo(() => state.snapshots.filter((snapshot) => !isRosterSnapshot(snapshot)), [state.snapshots]);
  const totalCost = calls.reduce((sum, snapshot) => sum + (snapshot.estimatedCostUsd ?? 0), 0);
  const grouped = useMemo(() => groupTurnsByRound(state.turns), [state.turns]);

  return (
    <section className="page">
      <RunHeader
        state={state}
        record={record}
        councilSize={councilSize}
        totalCost={totalCost}
      />

      <div className="tabs" role="tablist">
        <Tab id="verdict" current={tab} onSelect={setTab} label="Verdict" />
        <Tab id="floor" current={tab} onSelect={setTab} label="Debate floor" count={state.turns.length} />
        <Tab id="evidence" current={tab} onSelect={setTab} label="Evidence" count={state.sources.length} />
        <Tab id="graph" current={tab} onSelect={setTab} label="Argument map" />
        <Tab id="telemetry" current={tab} onSelect={setTab} label="Telemetry" count={calls.length} />
      </div>

      {state.errorMessage ? (
        <Callout tone="alert" title="The run failed" body={state.errorMessage} className="mt14" />
      ) : null}

      <div className="run-layout">
        <div className="stack">
          {tab === "floor" ? <DebateFloor state={state} grouped={grouped} /> : null}
          {tab === "verdict" ? <VerdictTab state={state} record={record} /> : null}
          {tab === "evidence" ? <EvidenceTab sources={state.sources} /> : null}
          {tab === "graph" ? <GraphTab state={state} /> : null}
          {tab === "telemetry" ? <TelemetryTab calls={calls} totalCost={totalCost} /> : null}
        </div>

        <Inspector state={state} calls={calls} totalCost={totalCost} />
      </div>
    </section>
  );
}

/* ------------------------------ Header ------------------------------ */

function RunHeader({
  state,
  record,
  councilSize,
  totalCost
}: {
  state: RunViewState;
  record: DebateRecord;
  councilSize: string;
  totalCost: number;
}) {
  const startedAt = record.latestRun?.startedAt ?? record.createdAt;
  const completedAt = record.latestRun?.completedAt;

  const statusTone = state.status === "failed" ? "alert" : state.status === "complete" ? "pro" : "neutral";

  return (
    <div className="run-head">
      <div className="crumbs">
        <Link href={"/runs" as Route}>Your runs</Link>
        <span>/</span>
        <span>Debate · {councilSize === "Duo" ? "1 vs 1" : "2 vs 2"} with a judge</span>
        {state.topicKind ? (
          <>
            <span>/</span>
            <span>{state.topicKind}</span>
          </>
        ) : null}
        <span className={`chip push ${statusTone}`}>
          {statusTone !== "neutral" ? <span className="dot" /> : <span className="spin sm" />}
          {stageLabel(state.status)} · <Elapsed startedAt={startedAt} completedAt={completedAt} running={!state.done} /> ·{" "}
          {formatCost(totalCost)}
        </span>
      </div>

      <h1 className="display d2 run-res">{state.resolution ?? state.subject}</h1>

      {state.highStakes ? (
        <Callout
          tone="note"
          title={`${state.highStakes.category} topic — a disclaimer is attached to the verdict`}
          body={state.highStakes.message}
          className="mt14"
        />
      ) : null}

      <Stepper status={state.status} />
    </div>
  );
}

function Elapsed({
  startedAt,
  completedAt,
  running
}: {
  startedAt: string;
  completedAt?: string;
  running: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : now;
  const seconds = Math.max(0, Math.round((end - start) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <>
      {mm}:{ss}
    </>
  );
}

function Stepper({ status }: { status: DebateStatus }) {
  const currentIndex = stages.findIndex((stage) => stage.id === status);
  const isComplete = status === "complete";
  const isFailed = status === "failed";

  return (
    <div className="stepper">
      {stages.map((stage, index) => {
        const done = isComplete || (currentIndex >= 0 && index < currentIndex);
        const now = !isComplete && !isFailed && stage.id === status;
        const failed = isFailed && index === Math.max(currentIndex, 0);
        const className = failed ? "step failed" : done ? "step done" : now ? "step now" : "step";
        return (
          <div className={className} key={stage.id}>
            <span className="step-i">{failed ? "!" : done ? "✓" : index + 1}</span>
            <span className="step-l">{stage.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function Tab({
  id,
  current,
  onSelect,
  label,
  count
}: {
  id: TabId;
  current: TabId;
  onSelect: (id: TabId) => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={current === id}
      className={`tab${current === id ? " on" : ""}`}
      onClick={() => onSelect(id)}
    >
      {label}
      {count ? <span className="n">{count}</span> : null}
    </button>
  );
}

/* ------------------------------ Debate floor ------------------------------ */

function DebateFloor({
  state,
  grouped
}: {
  state: RunViewState;
  grouped: Partial<Record<DebateRound, RoundTurn[]>>;
}) {
  const presentRounds = roundOrder.filter(
    (round) => grouped[round]?.length || state.turnFailuresByRound[round]
  );
  const isDebating = state.status === "debating";
  const isAwaiting =
    state.status === "queued" || state.status === "framing" || state.status === "researching";

  if (presentRounds.length === 0) {
    return (
      <div className="card card-pad">
        <div className="row gap8">
          {isAwaiting || isDebating ? <span className="spin" /> : null}
          <span className="small">
            {isAwaiting
              ? `Preparing the council — ${stageLabel(state.status)}`
              : isDebating
                ? "Agents are speaking"
                : "No turns were recorded for this run."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div>
      {presentRounds.map((round, roundIndex) => {
        const failure = state.turnFailuresByRound[round];
        const turns = grouped[round] ?? [];
        return (
          <div className="floor-round" key={round}>
            <div className="round-head">
              <span className="eyebrow">
                Round {roundIndex + 1} · {roundLabels[round]}
              </span>
              <hr className="rule" />
            </div>
            {failure ? (
              <RoundFailed info={failure} />
            ) : (
              <div className="lane">
                {turns.map((turn) => (
                  <Turn key={turn.id} turn={turn} state={state} />
                ))}
              </div>
            )}
          </div>
        );
      })}

      {isDebating ? (
        <Callout
          tone="note"
          spinner
          title="The council is still speaking"
          body="You can leave this page — the run continues on the server and the artifact is saved either way."
          className="mt14"
        />
      ) : null}
    </div>
  );
}

function Turn({ turn, state }: { turn: RoundTurn; state: RunViewState }) {
  const proIndex = (state.teams?.pro ?? []).findIndex((candidate) => candidate.id === turn.agentId);
  const conIndex = (state.teams?.con ?? []).findIndex((candidate) => candidate.id === turn.agentId);
  const agent = proIndex >= 0 ? state.teams?.pro[proIndex] : conIndex >= 0 ? state.teams?.con[conIndex] : undefined;
  // The model that actually wrote this turn, when the engine recorded it
  // (core 0.3.4+). Otherwise the best available answer is the model the
  // speaking agent was assigned.
  const model = turn.model ?? agent?.model ?? state.teams?.judge.model;
  const tone = turn.side === "pro" ? "pro" : turn.side === "con" ? "con" : "judge";
  const initials = proIndex >= 0 ? `P${proIndex + 1}` : conIndex >= 0 ? `C${conIndex + 1}` : "J";
  const sideLabel = turn.side === "pro" ? "arguing for" : turn.side === "con" ? "arguing against" : "judge";

  return (
    <article className={`turn ${tone}`}>
      <div className="turn-h">
        <span className={`av lg ${tone}`} aria-hidden="true">
          {initials}
        </span>
        <div className="turn-who">
          <span className="turn-name">{turn.agentName}</span>
          <span className="turn-role">
            {sideLabel}
            {agent?.role ? ` · ${agent.role}` : ""}
            {model ? ` · ${model}` : ""}
          </span>
        </div>
      </div>
      <div className="turn-body">{turn.content}</div>
      {turn.sourceIds.length > 0 ? (
        <div className="turn-foot">
          {turn.sourceIds.map((sourceId) => (
            <span className="cite" key={sourceId} title={sourceId}>
              {sourceRef(state.sources, sourceId)}
            </span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function RoundFailed({ info }: { info: PlaceholderInfo }) {
  return (
    <Callout
      tone="alert"
      title="This round didn't run"
      body={`Asked ${info.requestedModel} but no usable response came back. ${info.reason}`}
    />
  );
}

/* ------------------------------ Verdict ------------------------------ */

function VerdictTab({ state, record }: { state: RunViewState; record: DebateRecord }) {
  const verdictFellBack = Boolean(state.fallbacks.scorecard || state.fallbacks.summary);

  if (verdictFellBack) {
    const reasons: Array<[string, PlaceholderInfo]> = [];
    if (state.fallbacks.scorecard) reasons.push(["Scorecard", state.fallbacks.scorecard]);
    if (state.fallbacks.summary) reasons.push(["Summary", state.fallbacks.summary]);

    return (
      <div className="card card-pad">
        <span className="chip alert">
          <span className="dot" />
          Verdict unavailable
        </span>
        <h2 className="display d3 mt14">The judge step couldn&apos;t run on the selected model</h2>
        <p className="small mt10 mw640">
          The placeholder text built into the engine is not a real answer and is not displayed. Pick a different judge
          model and run it again.
        </p>
        <ul className="rule-list mt14">
          {reasons.map(([label, info]) => (
            <li key={label}>
              <b>{label}</b> — requested <code>{info.requestedModel}</code>
              <div className="meta mt6">{info.reason}</div>
            </li>
          ))}
        </ul>
        <div className="row gap8 wrap mt18">
          <Link href={"/" as Route} className="btn">
            Re-run with different models
          </Link>
        </div>
      </div>
    );
  }

  if (!state.scorecard || !state.summary) {
    return (
      <div className="card card-pad">
        <div className="row gap8">
          <span className="spin" />
          <span className="small">Waiting for the verdict — {stageLabel(state.status)}.</span>
        </div>
      </div>
    );
  }

  const { scorecard, summary } = state;
  const confidence = Math.round(scorecard.confidence * 100);
  const proTotal = scorecard.categories.reduce((sum, category) => sum + category.pro, 0);
  const conTotal = scorecard.categories.reduce((sum, category) => sum + category.con, 0);
  const total = proTotal + conTotal || 1;
  const proShare = Math.round((proTotal / total) * 100);
  const proLead = scorecard.categories.filter((category) => category.pro >= category.con);
  const conLead = scorecard.categories.filter((category) => category.con > category.pro);
  const tone = recommendationTone(scorecard.recommendation);

  return (
    <div>
      <div className="verdict">
        <div className="verdict-body">
          <div className="verdict-top">
            <div style={{ minWidth: 0, flex: 1 }}>
              <span className={`chip ${tone}`}>
                <span className="dot" />
                {formatRecommendation(scorecard.recommendation)}
              </span>
              <h2 className="display d2">{summary.headline}</h2>
              <p className="lede mt14" style={{ fontSize: "14.5px" }}>
                {summary.recommendation}
              </p>
            </div>
            <div className="gauge">
              <ConfidenceRing value={confidence} />
              <span className="meta">
                {proLead.length} of {scorecard.categories.length} dimensions to the {proLead.length >= conLead.length ? "yes" : "no"} side
              </span>
            </div>
          </div>

          <div className="balance">
            <div className="balance-bar">
              <div className="balance-pro" style={{ width: `${proShare}%` }} />
              <div className="balance-con" style={{ width: `${100 - proShare}%` }} />
            </div>
            <div className="balance-key">
              <span className="key-pro">For · {proShare}</span>
              <span className="key-con">{100 - proShare} · Against</span>
            </div>
          </div>
        </div>

        <div className="verdict-scores">
          <div className="row gap10 wrap" style={{ marginBottom: 6 }}>
            <span className="card-title">How the judge scored it</span>
            {state.teams ? <span className="agent-m push">{state.teams.judge.model} · neutral seat</span> : null}
          </div>
          {scorecard.categories.map((category) => {
            const categoryTotal = category.pro + category.con || 1;
            const proWidth = Math.round((category.pro / categoryTotal) * 100);
            return (
              <div className="score-row" key={category.name}>
                <span className="score-name">{category.name}</span>
                <div className="score-bars">
                  <div className="sb sb-pro" style={{ width: `${proWidth}%` }} />
                  <div className="sb sb-con" style={{ width: `${100 - proWidth}%` }} />
                </div>
                <span className="score-note">{category.note}</span>
              </div>
            );
          })}
        </div>
      </div>

      {state.summary?.highStakesDisclaimer ? (
        <Callout tone="note" title="Disclaimer" body={state.summary.highStakesDisclaimer} className="mt18" />
      ) : null}

      <div className="grid g2 mt18">
        <ListCard tone="pro" title="Strongest arguments for" items={summary.strongestPro} />
        <ListCard tone="con" title="Strongest arguments against" items={summary.strongestCon} />
      </div>

      <div className="grid g2 mt18">
        <ListCard title="Unresolved after the debate" items={summary.unresolvedUncertainties} />
        <ListCard title="What would change this verdict" items={summary.whatWouldChangeMind} />
      </div>

      <div className="row gap8 wrap mt18">
        <Link href={"/" as Route} className="btn">
          Re-run with different models
        </Link>
        <a className="btn" href={`/api/debates/${record.id}`} download={`${record.id}.json`}>
          Export artifact ↓
        </a>
      </div>

      <Followups record={record} />
    </div>
  );
}

/** The confidence figure as a ring: 132px, the arc reads clockwise from the top. */
function ConfidenceRing({ value }: { value: number }) {
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const filled = (Math.max(0, Math.min(100, value)) / 100) * circumference;

  return (
    <svg className="gauge-ring" viewBox="0 0 132 132" role="img" aria-label={`${value}% confidence`}>
      <circle cx="66" cy="66" r={radius} fill="none" className="gauge-track" strokeWidth="10" />
      <circle
        cx="66"
        cy="66"
        r={radius}
        fill="none"
        className="gauge-fill"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform="rotate(-90 66 66)"
      />
      <text x="66" y="62" textAnchor="middle" className="gauge-v">
        {value}
      </text>
      <text x="66" y="84" textAnchor="middle" className="gauge-pct" fontFamily="var(--ui)">
        confidence
      </text>
    </svg>
  );
}

function ListCard({
  title,
  items,
  tone
}: {
  title: string;
  items: string[];
  tone?: "pro" | "con";
}) {
  return (
    <div className="card">
      <div className="card-head">
        {tone ? (
          <span className={`chip ${tone}`}>
            <span className="dot" />
            {tone}
          </span>
        ) : null}
        <span className="card-title">{title}</span>
      </div>
      <div className="card-pad">
        {items.length ? (
          <ul className={`rule-list${tone ? ` ${tone}` : ""}`}>
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="small">Nothing recorded for this section.</p>
        )}
      </div>
    </div>
  );
}

function Followups({ record }: { record: DebateRecord }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (question.trim().length < 4 || isLoading) return;

    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/debates/${record.id}/followups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to answer the follow-up.");
      }
      setQuestion("");
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to answer the follow-up.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="card mt18">
      <div className="card-head">
        <span className="card-title">Ask the judge a follow-up</span>
        {record.followups.length ? <span className="meta push">{record.followups.length} answered</span> : null}
      </div>
      <div className="card-pad">
        <form onSubmit={handleSubmit} className="row gap10 wrap">
          <input
            className="ctx-input"
            style={{ flex: 1, minWidth: 220, minHeight: 0, height: "var(--ctl)", padding: "0 14px", resize: "none" }}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What if we only did email, not chat?"
            aria-label="Follow-up question"
          />
          <button type="submit" className="btn btn-primary" disabled={isLoading || question.trim().length < 4}>
            {isLoading ? <span className="spin sm" /> : null}
            Ask
          </button>
        </form>

        {error ? <Callout tone="alert" title="Follow-up failed" body={error} className="mt14" /> : null}

        {record.followups.length > 0 ? (
          <div className="mt14">
            {record.followups.map((followup) => (
              <div className="ins-row" key={followup.id} style={{ display: "block", padding: "12px 0" }}>
                <div className="turn-name">{followup.question}</div>
                <p className="small mt6">{followup.answer}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------ Evidence ------------------------------ */

const evidenceFilters = ["all", "primary", "expert", "methodology", "context"] as const;
type EvidenceFilter = (typeof evidenceFilters)[number];

function EvidenceTab({ sources }: { sources: EvidenceSource[] }) {
  const [filter, setFilter] = useState<EvidenceFilter>("all");

  if (sources.length === 0) {
    return (
      <div className="card card-pad">
        <p className="small">No sources were retrieved for this run.</p>
      </div>
    );
  }

  const accepted = sources.filter((source) => source.status === "accepted").length;
  const rejected = sources.filter((source) => source.status === "rejected").length;
  const visible = filter === "all" ? sources : sources.filter((source) => source.quality === filter);

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Source ledger</span>
        <span className="meta">
          {sources.length} retrieved · {accepted} accepted · {rejected} rejected
        </span>
        <div className="row gap6 push wrap">
          {evidenceFilters.map((option) => (
            <button
              type="button"
              key={option}
              className={`chip${filter === option ? " pro" : ""}`}
              onClick={() => setFilter(option)}
            >
              {filter === option ? <span className="dot" /> : null}
              {option}
            </button>
          ))}
        </div>
      </div>
      <div className="card-pad" style={{ paddingTop: 4 }}>
        {visible.length === 0 ? (
          <p className="small">No sources graded {filter} in this run.</p>
        ) : (
          visible.map((source) => (
            <div className={`src${source.status === "rejected" ? " rejected" : ""}`} key={source.id}>
              <span className="src-n">{sourceRef(sources, source.id)}</span>
              <div style={{ minWidth: 0 }}>
                <a className="src-t" href={source.url} target="_blank" rel="noreferrer">
                  {source.title}
                </a>
                <div className="src-m">
                  <span className={`chip${source.quality === "primary" ? " pro" : ""}`}>{source.quality}</span>
                  {source.status === "rejected" ? <span className="chip alert">Rejected</span> : null}
                  <span className="meta">
                    {source.publisher}
                    {source.publishedAt ? ` · ${source.publishedAt}` : ""} · via {source.retrievedVia}
                  </span>
                </div>
                <div className="src-s">{source.snippet}</div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ------------------------------ Argument map ------------------------------ */

function GraphTab({ state }: { state: RunViewState }) {
  if (state.argumentNodes.length === 0) {
    return (
      <div className="card card-pad">
        <p className="small">The argument map is built once claims and evidence are in.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Argument map</span>
        <div className="row gap6 push wrap">
          <span className="chip pro">
            <span className="dot" />
            supports
          </span>
          <span className="chip con">
            <span className="dot" />
            challenges
          </span>
          <span className="chip judge">
            <span className="dot" />
            qualifies
          </span>
        </div>
      </div>
      <div className="graph-wrap flush">
        <ArgumentMap nodes={state.argumentNodes} edges={state.argumentEdges} />
      </div>
    </div>
  );
}

/* ------------------------------ Telemetry ------------------------------ */

function slotForRole(role: string): { label: string; tone: string } {
  const normalized = role.toLowerCase();
  if (normalized.includes("judge") || normalized.includes("summary") || normalized.includes("scorecard")) {
    return { label: "judge", tone: "judge" };
  }
  // Mirrors the engine's own routing (modelForRole): side names win, then
  // claims, then everything else lands on the framing seat.
  if (normalized.includes("yes frog")) return { label: "pro side", tone: "pro" };
  if (normalized.includes("no frog")) return { label: "con side", tone: "con" };
  if (normalized.includes("claim") || normalized.includes("rebuttal")) return { label: "claims", tone: "neutral" };
  return { label: "framing", tone: "neutral" };
}

function TelemetryTab({ calls, totalCost }: { calls: ModelSnapshot[]; totalCost: number }) {
  if (calls.length === 0) {
    return (
      <div className="card card-pad">
        <p className="small">No model calls have been recorded yet.</p>
      </div>
    );
  }

  const retries = calls.reduce((sum, snapshot) => sum + Math.max(0, (snapshot.attempts?.length ?? 1) - 1), 0);
  const maxLatency = Math.max(1, ...calls.map((snapshot) => snapshot.latencyMs ?? 0));
  const retried = calls.filter((snapshot) => (snapshot.attempts?.length ?? 1) > 1);

  return (
    <div>
      <div className="card">
        <div className="card-head">
          <span className="card-title">Model calls</span>
          <span className="meta push">
            {calls.length} calls · {retries} retries · {formatCost(totalCost)}
          </span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Step</th>
                <th>Model</th>
                <th>Slot</th>
                <th className="num">Latency</th>
                <th className="num">Tokens</th>
                <th className="num">Cost</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((snapshot, index) => (
                <SnapshotRow
                  key={`${snapshot.id}-${index}`}
                  snapshot={snapshot}
                  maxLatency={maxLatency}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {retried.map((snapshot, index) => (
        <Callout
          key={`${snapshot.id}-retry-${index}`}
          tone="alert"
          className="mt14"
          title={`${snapshot.role} retried ${(snapshot.attempts?.length ?? 1) - 1} time(s)`}
          body={
            snapshot.attempts
              ?.map((attempt) => `attempt ${attempt.attempt} (${attempt.mode}): ${attempt.status}${attempt.message ? ` — ${attempt.message}` : ""}`)
              .join(" · ") ?? ""
          }
        />
      ))}
    </div>
  );
}

function SnapshotRow({ snapshot, maxLatency }: { snapshot: ModelSnapshot; maxLatency: number }) {
  const slot = slotForRole(snapshot.role);
  const tokens = (snapshot.promptTokens ?? 0) + (snapshot.completionTokens ?? 0);
  const sparkWidth = Math.round(((snapshot.latencyMs ?? 0) / maxLatency) * 56);

  return (
    <tr className={snapshot.configured ? undefined : "dim"}>
      <td>{snapshot.role}</td>
      <td>
        <code>{snapshot.model}</code>
      </td>
      <td>
        <span className={`chip ${slot.tone}`}>{slot.label}</span>
      </td>
      <td className="num">
        {formatLatency(snapshot.latencyMs)}{" "}
        {sparkWidth > 0 ? <span className="spark" style={{ width: sparkWidth }} /> : null}
      </td>
      <td className="num">{formatTokens(tokens)}</td>
      <td className="num">{snapshot.estimatedCostUsd ? formatCost(snapshot.estimatedCostUsd) : "—"}</td>
      <td>
        {snapshot.failure ? (
          <span className="chip alert" title={snapshot.failure}>
            <span className="dot" />
            fell back
          </span>
        ) : !snapshot.configured ? (
          <span className="chip">
            <span className="dot" />
            no key
          </span>
        ) : (
          <span className="chip pro">
            <span className="dot" />
            ok
          </span>
        )}
      </td>
    </tr>
  );
}

/* ------------------------------ Inspector ------------------------------ */

function Inspector({
  state,
  calls,
  totalCost
}: {
  state: RunViewState;
  calls: ModelSnapshot[];
  totalCost: number;
}) {
  const fallbackSteps = Object.keys(state.fallbacks) as StepId[];
  const acceptedSources = state.sources.filter((source) => source.status === "accepted").length;
  const retries = calls.reduce((sum, snapshot) => sum + Math.max(0, (snapshot.attempts?.length ?? 1) - 1), 0);

  return (
    <aside className="inspector">
      {state.teams ? (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Who was in the room</span>
            <span className="meta push">
              {state.teams.pro.length + state.teams.con.length + 1} seats
            </span>
          </div>
          <div className="card-pad" style={{ paddingTop: 6, paddingBottom: 10 }}>
            {state.teams.pro.map((agent, index) => (
              <AgentRow key={agent.id} tone="pro" initials={`P${index + 1}`} name={agent.name} meta={`${agent.model} · ${agent.role}`} />
            ))}
            {state.teams.con.map((agent, index) => (
              <AgentRow key={agent.id} tone="con" initials={`C${index + 1}`} name={agent.name} meta={`${agent.model} · ${agent.role}`} />
            ))}
            <AgentRow
              tone="judge"
              initials="J"
              name={state.teams.judge.name}
              meta={`${state.teams.judge.model} · ${state.teams.judge.role}`}
            />
          </div>
        </div>
      ) : null}

      <div className="card card-pad">
        <div className="card-title">This run</div>
        <div className="mt10">
          <InsRow k="Turns" v={String(state.turns.length)} />
          <InsRow k="Claims" v={String(state.claims.length)} />
          <InsRow k="Sources accepted" v={`${acceptedSources} / ${state.sources.length}`} />
          <InsRow k="Model calls" v={`${calls.length} · ${retries} retries`} />
          <InsRow k="Cost" v={formatCost(totalCost)} />
          <InsRow k="Status" v={stageLabel(state.status)} />
        </div>
      </div>

      {fallbackSteps.length > 0 ? (
        <div className="card card-pad" style={{ borderColor: "var(--alert-line)" }}>
          <div className="card-title" style={{ color: "var(--alert-ink)" }}>
            Steps that fell back
          </div>
          <p className="small mt10">
            These sections are left empty rather than filled with the engine&apos;s placeholder text.
          </p>
          <ul className="rule-list mt10">
            {fallbackSteps.map((step) => (
              <li key={step}>
                <b>{stepLabels[step]}</b>
                <div className="meta mt6">{state.fallbacks[step]!.requestedModel}</div>
                <div className="meta">{state.fallbacks[step]!.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {state.scouts.length > 0 && !state.fallbacks.scouts ? (
        <div className="card card-pad">
          <div className="card-title">Opening positions</div>
          <p className="small mt10">Staked out before any model saw another&apos;s work.</p>
          <div className="mt14">
            {state.scouts.map((scout) => (
              <div className="ins-row" key={scout.id} style={{ display: "block" }}>
                <div className="row gap6 wrap">
                  <span className={`chip ${scout.side === "pro" ? "pro" : scout.side === "con" ? "con" : "judge"}`}>
                    <span className="dot" />
                    {scout.side}
                  </span>
                  <span className="turn-role">{scout.lens}</span>
                </div>
                <p className="small mt6">{scout.thesis}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function AgentRow({
  tone,
  initials,
  name,
  meta
}: {
  tone: "pro" | "con" | "judge";
  initials: string;
  name: string;
  meta: string;
}) {
  return (
    <div className="agent">
      <span className={`av ${tone}`}>{initials}</span>
      <div style={{ minWidth: 0 }}>
        <div className="agent-n">{name}</div>
        <div className="agent-m">{meta}</div>
      </div>
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

/* ------------------------------ Shared ------------------------------ */

function Callout({
  tone,
  title,
  body,
  className,
  spinner
}: {
  tone: "alert" | "note";
  title: string;
  body: string;
  className?: string;
  spinner?: boolean;
}) {
  return (
    <div className={`callout ${tone}${className ? ` ${className}` : ""}`}>
      {spinner ? (
        <span className="spin ci" />
      ) : (
        <svg
          className="ci"
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          style={{ color: tone === "alert" ? "var(--alert)" : "var(--muted)" }}
          aria-hidden="true"
        >
          {tone === "alert" ? (
            <>
              <path d="M8 2.4L14.6 13.6H1.4z" strokeLinejoin="round" />
              <path d="M8 6.6v3M8 11.4v.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              <circle cx="8" cy="8" r="6.2" />
              <path d="M8 7.4v3.4M8 5.2v.6" strokeLinecap="round" />
            </>
          )}
        </svg>
      )}
      <div>
        <h5>{title}</h5>
        <p>{body}</p>
      </div>
    </div>
  );
}

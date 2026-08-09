import type { EvidenceSource } from "@polyvise/core/debate/types";
import type {
  AdvisoryPanelRunEnvelope,
  ConsensusPosition,
  ConsensusRunEnvelope,
  ConsensusStance,
  PanelAdvice
} from "@polyvise/core/runs/types";
import type { PolyviseRecord } from "@/lib/run-record";

/* ------------------------------------------------------------------ shared */

function RunHead({ record, mode, tone }: { record: PolyviseRecord; mode: string; tone: string }) {
  return (
    <div className="mode-head">
      <div className="row gap8 wrap">
        <span className={`chip ${tone}`}>{mode}</span>
        <span className="meta">{record.id}</span>
      </div>
      <h2 className="display d2 mt10">{record.resolution || record.subject}</h2>
      {record.highStakes ? (
        <div className="callout alert mt14">
          <strong>{record.highStakes.category} topic</strong>
          <p className="small mt6">{record.highStakes.message}</p>
        </div>
      ) : null}
    </div>
  );
}

function SourceLedger({ sources }: { sources: EvidenceSource[] }) {
  if (!sources.length) return null;

  return (
    <div className="card mt24">
      <div className="card-head">
        <span className="card-title">Evidence</span>
        <span className="meta push">{sources.length} sources</span>
      </div>
      <div className="card-pad stack gap10">
        {sources.map((source) => (
          <div key={source.id} className="src-row">
            <span className={`chip ${source.quality === "primary" ? "pro" : ""}`}>{source.quality}</span>
            <div className="min0">
              <a href={source.url} target="_blank" rel="noreferrer noopener" className="src-title">
                {source.title}
              </a>
              <div className="meta">{source.publisher}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- consensus */

const stanceTone: Record<ConsensusStance, string> = {
  strongly_agree: "pro",
  agree: "pro",
  neutral: "",
  disagree: "con",
  strongly_disagree: "con"
};

function stanceLabel(stance: ConsensusStance): string {
  return stance.replace(/_/g, " ");
}

export function ConsensusSurface({ record, run }: { record: PolyviseRecord; run: ConsensusRunEnvelope }) {
  const { agents, rounds, convergence, holdouts, summary } = run.result;
  const peak = Math.max(...convergence.spreadByRound, 0.01);

  return (
    <section className="page">
      <RunHead record={record} mode="Consensus" tone="" />

      <div className="grid g2 mt24">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Convergence</span>
            <span className={`chip push ${convergence.converged ? "pro" : "con"}`}>
              {convergence.converged ? "Converged" : "No consensus"}
            </span>
          </div>
          <div className="card-pad">
            <div className="row gap10" style={{ alignItems: "baseline" }}>
              <span className="display d2">{Math.round(convergence.agreementLevel * 100)}%</span>
              <span className="small">agreement after {rounds.length} rounds</span>
            </div>

            {/* Spread per round: shorter bars mean the panel is closer together. */}
            <div className="spread-chart mt18">
              {convergence.spreadByRound.map((spread, index) => (
                <div className="spread-col" key={index}>
                  <div className="spread-track">
                    <div
                      className="spread-fill"
                      style={{ height: `${Math.max(4, (spread / peak) * 100)}%` }}
                    />
                  </div>
                  <span className="meta">R{index + 1}</span>
                </div>
              ))}
            </div>
            <p className="small mt14">{convergence.range}</p>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Where they landed</span>
          </div>
          <div className="card-pad">
            <h3 className="display d4">{summary.headline}</h3>
            <p className="small mt10">{summary.finding}</p>
            <p className="mt14" style={{ fontSize: "13px" }}>
              {convergence.finalAnswer}
            </p>
          </div>
        </div>
      </div>

      {holdouts.length ? (
        <div className="card mt24">
          <div className="card-head">
            <span className="card-title">Dissent</span>
            <span className="meta push">
              {holdouts.length} of {agents.length} outside the majority
            </span>
          </div>
          <div className="card-pad stack gap14">
            {holdouts.map((holdout) => (
              <div key={holdout.agentId}>
                <div className="row gap8 wrap">
                  <strong style={{ fontSize: "13px" }}>{holdout.agentName}</strong>
                  <span className={`chip ${stanceTone[holdout.stance]}`}>{stanceLabel(holdout.stance)}</span>
                </div>
                <p className="small mt6">{holdout.reason}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {summary.agreed.length || summary.contested.length ? (
        <div className="grid g2 mt24">
          <ListCard title="Agreed on" items={summary.agreed} tone="pro" />
          <ListCard title="Still contested" items={summary.contested} tone="con" />
        </div>
      ) : null}

      <div className="mt34">
        <div className="section-head ruled">
          <div>
            <span className="eyebrow">Transcript</span>
            <h3 className="display d3 mt6">Every round, every agent</h3>
          </div>
          <span className="small">Round 1 is answered blind — nobody has seen the others.</span>
        </div>

        <div className="stack gap24">
          {rounds.map((round) => (
            <div className="card" key={round.round}>
              <div className="card-head">
                <span className="card-title">Round {round.round}</span>
                <span className="meta">{round.round === 1 ? "independent" : "after seeing the panel"}</span>
                <span className="meta push">spread {round.spread.toFixed(2)}</span>
              </div>
              <div className="card-pad stack gap14">
                {round.positions.map((position) => (
                  <PositionRow key={position.id} position={position} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <SourceLedger sources={run.sources} />
    </section>
  );
}

function PositionRow({ position }: { position: ConsensusPosition }) {
  return (
    <div className="pos-row">
      <div className="row gap8 wrap">
        <strong style={{ fontSize: "13px" }}>{position.agentName}</strong>
        <span className={`chip ${stanceTone[position.stance]}`}>{stanceLabel(position.stance)}</span>
        {position.changedFromPrevious ? <span className="chip judge">moved</span> : null}
        {!position.model ? <span className="chip alert">placeholder</span> : null}
        <span className="meta push">{Math.round(position.confidence * 100)}% confident</span>
      </div>
      <p className="mt6" style={{ fontSize: "13px" }}>
        {position.answer}
      </p>
      <p className="small mt6">{position.rationale}</p>
    </div>
  );
}

/* ------------------------------------------------------------------- panel */

export function AdvisoryPanelSurface({
  record,
  run
}: {
  record: PolyviseRecord;
  run: AdvisoryPanelRunEnvelope;
}) {
  const { lenses, advice, chair } = run.result;

  return (
    <section className="page">
      <RunHead record={record} mode="Advisory Panel" tone="" />

      <div className="card mt24">
        <div className="card-head">
          <span className="card-title">Chair synthesis</span>
          <span className="meta push">{chair.confidence}% confidence</span>
        </div>
        <div className="card-pad">
          <h3 className="display d3">{chair.headline}</h3>
          <p className="lede mt10">{chair.throughLine}</p>
          <hr className="rule" style={{ margin: "18px 0" }} />
          <span className="eyebrow">What to do</span>
          <p className="mt6" style={{ fontSize: "13px" }}>
            {chair.decisionGuidance}
          </p>
        </div>
      </div>

      <div className="grid g2 mt24">
        <div className="card">
          <div className="card-head">
            <span className="card-title">Where they agree</span>
            <span className="meta push">{chair.agreements.length}</span>
          </div>
          <div className="card-pad stack gap14">
            {chair.agreements.length ? (
              chair.agreements.map((agreement, index) => (
                <div key={index}>
                  <p style={{ fontSize: "13px" }}>{agreement.point}</p>
                  <div className="row gap6 wrap mt6">
                    {agreement.lensIds.map((id) => (
                      <span className="chip pro" key={id}>
                        {id}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="small">No point drew agreement from two or more advisors.</p>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <span className="card-title">Where they conflict</span>
            <span className="meta push">{chair.conflicts.length}</span>
          </div>
          <div className="card-pad stack gap14">
            {chair.conflicts.length ? (
              chair.conflicts.map((conflict, index) => (
                <div key={index}>
                  <p style={{ fontSize: "13px" }}>{conflict.point}</p>
                  <div className="stack gap6 mt6">
                    {conflict.positions.map((position) => (
                      <div className="row gap8" key={position.lensId} style={{ alignItems: "flex-start" }}>
                        <span className="chip con">{position.lensId}</span>
                        <span className="small min0">{position.stance}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <p className="small">The advisors did not split on any point.</p>
            )}
          </div>
        </div>
      </div>

      <div className="mt34">
        <div className="section-head ruled">
          <div>
            <span className="eyebrow">The panel</span>
            <h3 className="display d3 mt6">Each lens, advising alone</h3>
          </div>
          <span className="small">No advisor saw another's answer before writing.</span>
        </div>

        <div className="grid g2">
          {advice.map((entry) => (
            <AdviceCard key={entry.id} advice={entry} brief={lenses.find((lens) => lens.id === entry.lensId)?.brief} />
          ))}
        </div>
      </div>

      <SourceLedger sources={run.sources} />
    </section>
  );
}

function AdviceCard({ advice, brief }: { advice: PanelAdvice; brief?: string }) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">{advice.lensName}</span>
        {!advice.model ? <span className="chip alert">placeholder</span> : null}
        <span className="meta push">{Math.round(advice.confidence * 100)}% confident</span>
      </div>
      <div className="card-pad">
        {brief ? <p className="meta">{brief}</p> : null}
        <p className="mt10" style={{ fontSize: "13px", color: "var(--ivory)" }}>
          {advice.recommendation}
        </p>
        <p className="small mt10">{advice.reasoning}</p>

        {advice.keyRisks.length ? (
          <>
            <span className="eyebrow" style={{ display: "block", marginTop: "16px" }}>
              Risks
            </span>
            <ul className="bullets mt6">
              {advice.keyRisks.map((risk, index) => (
                <li key={index}>{risk}</li>
              ))}
            </ul>
          </>
        ) : null}

        {advice.conditions.length ? (
          <>
            <span className="eyebrow" style={{ display: "block", marginTop: "16px" }}>
              Only if
            </span>
            <ul className="bullets mt6">
              {advice.conditions.map((condition, index) => (
                <li key={index}>{condition}</li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ListCard({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">{title}</span>
        <span className={`chip push ${tone}`}>{items.length}</span>
      </div>
      <div className="card-pad">
        {items.length ? (
          <ul className="bullets">
            {items.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="small">Nothing recorded.</p>
        )}
      </div>
    </div>
  );
}

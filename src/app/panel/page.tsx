import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";

export const metadata: Metadata = {
  title: "Advisory panel | Polyvise",
  description: "A mode where named perspectives advise separately and a chair writes up the overlap."
};

const advisors = [
  {
    lens: "lens1",
    name: "The Economist",
    role: "unit economics, second-order effects",
    body: "The payback question is less interesting than the substitution question. If deflection works you don't save a headcount, you redeploy it, and the value shows up wherever that person goes next. Budget it as reallocation rather than savings, or you'll be measuring the wrong thing by Q3."
  },
  {
    lens: "lens2",
    name: "The Ethicist",
    role: "obligations, affected parties",
    body: "Disclosure is the load-bearing question. A customer who doesn't know they're talking to a system can't calibrate how much to trust the answer, and the people most likely to be harmed by that are the ones least able to escalate. Whatever you deploy, the handoff has to be one action rather than a maze."
  },
  {
    lens: "lens3",
    name: "The Operator",
    role: "has actually shipped this",
    body: "Everyone underestimates the content job. Someone owns the knowledge base or the whole thing decays within ten weeks, and it can't be the support lead in their spare time. If you can't name that person today, you're not ready to buy the tool."
  },
  {
    lens: "lens4",
    name: "The Skeptic",
    role: "assumes the plan fails",
    body: "Assume it goes badly. What's the tell, and how fast do you see it? If your only signal is quarterly satisfaction data you'll be six weeks into a trust problem before it's visible. Instrument escalation rate weekly and set the number that triggers rollback before you sign anything."
  }
];

export default function PanelPage() {
  return (
    <section className="page">
      <div className="row gap8 wrap">
        <span className="eyebrow">Deliberation mode</span>
        <span className="chip pro">
          <span className="dot" />
          Live
        </span>
      </div>
      <h2 className="display d2 mt10">Advisory panel</h2>
      <p className="lede mt10 mw640">
        Each advisor works from a named perspective and answers in its own voice. Nobody argues against anyone else and
        no winner is declared — a chair reads the advice and writes up where it agrees and where it doesn&apos;t.
      </p>

      <div className="grid g2 mt24">
        {advisors.map((advisor) => (
          <div className={`turn ${advisor.lens}`} key={advisor.name}>
            <div className="turn-h">
              <span className="turn-name">{advisor.name}</span>
              <span className="turn-role">{advisor.role}</span>
            </div>
            <div className="turn-body">{advisor.body}</div>
          </div>
        ))}
      </div>

      <div className="card chair mt18">
        <div className="card-head">
          <span className="chip judge">
            <span className="dot" />
            Chair
          </span>
          <span className="card-title">Synthesis</span>
          <span className="meta push">no verdict issued — this mode advises</span>
        </div>
        <div className="card-pad">
          <p style={{ fontSize: 14, lineHeight: 1.65 }}>
            Three of the four advisors land on a precondition rather than a decision: name the knowledge-base owner.
            The economist and the operator get there from cost, the skeptic from failure detection. The
            ethicist&apos;s point about disclosure is unrelated to the other three and nobody else addresses it, so
            it&apos;s better handled as a separate piece of work.
          </p>
          <div className="row gap8 wrap mt14">
            <span className="chip judge">3 of 4 share a precondition</span>
            <span className="chip">1 unrelated concern</span>
            <span className="chip">0 direct contradictions</span>
          </div>
        </div>
      </div>

      <div className="hero-cta">
        <Link href={"/" as Route} className="btn btn-primary btn-lg">
          Ask a question
        </Link>
        <Link href={"/runs" as Route} className="btn">
          Your past runs
        </Link>
      </div>

      <p className="meta mt18">
        The advice above illustrates the shape of the output. Run one to see real advice.
      </p>
    </section>
  );
}

import { PendingModeRun } from "@/components/pending-mode-run";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RunSurface } from "@/components/run-surface";
import { AdvisoryPanelSurface, ConsensusSurface } from "@/components/mode-surface";
import { asAdvisoryPanelRun, asConsensusRun, asDebateRecord } from "@/lib/run-record";
import { getDebate } from "@/server/debate-store";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const debate = await getDebate(id).catch(() => null);
  return {
    title: debate ? `${debate.subject} | Polyvise` : "Run | Polyvise"
  };
}

export default async function RunPage({ params }: PageProps) {
  const { id } = await params;
  const debate = await getDebate(id);

  if (!debate) {
    notFound();
  }

  // Preserve each mode’s identity while waiting for its result envelope.
  if (!debate.latestRun && debate.mode !== "hybrid_council") {
    return <PendingModeRun record={debate} />;
  }
  const consensus = debate.latestRun ? asConsensusRun(debate.latestRun) : null;
  if (consensus) {
    return <ConsensusSurface record={debate} run={consensus} />;
  }

  const panel = debate.latestRun ? asAdvisoryPanelRun(debate.latestRun) : null;
  if (panel) {
    return <AdvisoryPanelSurface record={debate} run={panel} />;
  }

  return <RunSurface record={asDebateRecord(debate)} />;
}

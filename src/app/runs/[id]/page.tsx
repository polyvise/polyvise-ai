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

  // Dispatch on what the run actually produced. A record whose run has not
  // finished yet has nothing to narrow on, so it falls through to the debate
  // surface, which is the one that renders an in-flight run.
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

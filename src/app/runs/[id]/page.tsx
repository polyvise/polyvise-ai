import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RunSurface } from "@/components/run-surface";
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

  return <RunSurface record={debate} />;
}

import { Composer } from "@/components/composer";
import { parseMode } from "@/lib/mode-guide";

type Props = { searchParams: Promise<{ mode?: string | string[] }> };

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const initialMode = parseMode(typeof params.mode === "string" ? params.mode : undefined);
  return (
    <div className="decision-home canvas-home">
      <Composer key={initialMode} initialMode={initialMode} />
    </div>
  );
}

import type { CouncilSize, DebateMode } from "@polyvise/core/debate/types";

/** A schematic of roles, never a claim about distinct model providers. */
export function ModeDiagram({
  mode,
  councilSize = "quartet",
  agentCount = 5,
}: {
  mode: DebateMode;
  councilSize?: CouncilSize;
  agentCount?: number;
}) {
  const labels =
    mode === "hybrid_council"
      ? councilSize === "duo"
        ? ["For", "Against"]
        : ["For", "For", "Against", "Against"]
      : mode === "consensus"
        ? Array.from({ length: agentCount }, (_, i) => `P${i + 1}`)
        : ["Economist", "Ethicist", "Operator", "Skeptic"];
  const end =
    mode === "hybrid_council"
      ? "Neutral judge"
      : mode === "consensus"
        ? "Shared answer + dissent"
        : "Panel chair";
  return (
    <div className={`room-diagram diagram-${mode}`}>
      <svg
        viewBox="0 0 360 192"
        role="img"
        aria-label={`${labels.join(", ")} contribute to ${end.toLowerCase()}.`}
      >
        <defs>
          <pattern
            id={`room-grid-${mode}`}
            width="18"
            height="18"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="1" cy="1" r="0.8" fill="var(--line-2)" />
          </pattern>
        </defs>
        <rect width="360" height="192" fill={`url(#room-grid-${mode})`} />
        {labels.map((label, index) => {
          const x = 30 + (300 / labels.length) * (index + 0.5);
          const tone =
            mode === "hybrid_council"
              ? index < labels.length / 2
                ? "pro"
                : "con"
              : mode === "consensus"
                ? "pro"
                : `lens-${index + 1}`;
          return (
            <g key={`${mode}-${index}`}>
              <path
                d={`M${x} 64 C${x} 100 180 88 180 127`}
                fill="none"
                stroke={`var(--${tone})`}
                strokeWidth="1.2"
                opacity="0.5"
              />
              <circle
                cx={x}
                cy="48"
                r={labels.length > 5 ? 15 : 19}
                fill="var(--surface)"
                stroke={`var(--${tone})`}
                strokeWidth="1.5"
              />
              <circle cx={x} cy="44" r="4" fill={`var(--${tone})`} />
              <path
                d={`M${x - 7} 54 Q${x} 43 ${x + 7} 54`}
                fill={`var(--${tone})`}
              />
              <text
                x={x}
                y="84"
                textAnchor="middle"
                fill="var(--muted)"
                fontSize={mode === "advisory_panel" ? "9" : "10"}
                fontFamily="var(--ui)"
              >
                {label}
              </text>
            </g>
          );
        })}
        <rect
          x="94"
          y="127"
          width="172"
          height="36"
          rx="18"
          fill="var(--surface)"
          stroke="var(--judge-line)"
        />
        <circle cx="110" cy="145" r="3" fill="var(--judge)" />
        <text
          x="185"
          y="149"
          textAnchor="middle"
          fill="var(--judge-ink)"
          fontSize="11"
          fontFamily="var(--ui)"
        >
          {end}
        </text>
      </svg>
    </div>
  );
}

"use client";

import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node
} from "@xyflow/react";
import type { ArgumentEdge, ArgumentNode } from "@polyvise/core/debate/types";

type ArgumentMapProps = {
  nodes: ArgumentNode[];
  edges: ArgumentEdge[];
};

/**
 * React Flow needs concrete values rather than class names, so every colour
 * here is read back out of the same CSS variables the rest of the app styles
 * from — which also means the map repaints on a theme switch.
 */
const sideTokens: Record<ArgumentNode["side"], { accent: string; border: string; background: string }> = {
  pro: { accent: "var(--pro)", border: "var(--pro-line)", background: "var(--pro-soft)" },
  con: { accent: "var(--con)", border: "var(--con-line)", background: "var(--con-soft)" },
  neutral: { accent: "var(--judge)", border: "var(--judge-line)", background: "var(--judge-soft)" }
};

const relationColor: Record<ArgumentEdge["relation"], string> = {
  supports: "var(--pro)",
  challenges: "var(--con)",
  qualifies: "var(--judge)",
  summarizes: "var(--muted)"
};

export function ArgumentMap({ nodes, edges }: ArgumentMapProps) {
  const flowNodes = toFlowNodes(nodes);
  const flowEdges = edges.map(toFlowEdge);

  return (
    <div style={{ height: 520, minHeight: 420, background: "var(--sunken)" }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.35}
        maxZoom={1.6}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="var(--dot)" gap={18} />
        <MiniMap pannable zoomable nodeStrokeWidth={3} maskColor="var(--hover-3)" />
        <Controls />
      </ReactFlow>
    </div>
  );
}

function toFlowNodes(nodes: ArgumentNode[]): Node[] {
  const proNodes = nodes.filter((node) => node.side === "pro");
  const conNodes = nodes.filter((node) => node.side === "con");
  const neutralNodes = nodes.filter((node) => node.side === "neutral" && node.id !== "resolution");
  const resolution = nodes.find((node) => node.id === "resolution") ?? nodes[0];

  const positioned: Array<{ node: ArgumentNode; x: number; y: number }> = [];

  if (resolution) {
    positioned.push({ node: resolution, x: 120, y: 20 });
  }

  proNodes.forEach((node, index) => {
    positioned.push({ node, x: -260, y: 140 + index * 110 });
  });

  conNodes.forEach((node, index) => {
    positioned.push({ node, x: 520, y: 140 + index * 110 });
  });

  neutralNodes.forEach((node, index) => {
    positioned.push({ node, x: 120, y: 180 + index * 105 });
  });

  return positioned.map(({ node, x, y }) => {
    const tokens = sideTokens[node.side];

    return {
      id: node.id,
      type: "default",
      position: { x, y },
      data: {
        label: (
          <div style={{ padding: 12, textAlign: "left" }}>
            <div className="row gap6">
              <span
                style={{
                  height: 7,
                  width: 7,
                  flex: "none",
                  borderRadius: "50%",
                  backgroundColor: tokens.accent
                }}
                aria-hidden="true"
              />
              <span className="eyebrow">{node.kind}</span>
            </div>
            <div className="turn-name mt6">{node.label}</div>
            <div className="small mt6" style={{ fontSize: 11.5, lineHeight: 1.45 }}>
              {node.detail}
            </div>
          </div>
        )
      },
      style: {
        background: tokens.background,
        borderColor: tokens.border,
        width: node.id === "resolution" ? 310 : 230
      }
    };
  });
}

function toFlowEdge(edge: ArgumentEdge): Edge {
  const color = relationColor[edge.relation] ?? "var(--muted)";

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    animated: edge.relation === "qualifies",
    label: edge.relation,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color
    },
    style: {
      stroke: color,
      strokeWidth: 2
    },
    labelStyle: {
      fill: "var(--text)",
      fontSize: 11,
      fontWeight: 600
    },
    labelBgStyle: {
      fill: "var(--surface)",
      fillOpacity: 0.9
    }
  };
}

import cytoscape, { type Core, type ElementDefinition, type StylesheetJson } from 'cytoscape';
import dagre from 'cytoscape-dagre';
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ContentType, GraphEdgeOut, GraphNode } from '../types/api';

let dagreRegistered = false;
function ensureDagreRegistered() {
  if (dagreRegistered) return;
  cytoscape.use(dagre);
  dagreRegistered = true;
}

const TYPE_COLORS: Record<ContentType, string> = {
  radical: '#7aa2f7',
  kanji: '#9ece6a',
  vocabulary: '#e0af68',
  grammar: '#bb9af7',
  reading: '#f7768e',
};

/** Approximate dependency depth, used only to size the dagre layout to the canvas. */
const RANK_HINT: Record<ContentType, number> = {
  radical: 0,
  grammar: 0,
  kanji: 1,
  vocabulary: 2,
  reading: 2,
};

function nodeKey(type: ContentType, slug: string): string {
  return `${type}:${slug}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * dagre's `fit: true` preserves aspect ratio, so a graph with few rank levels but
 * many nodes per level (e.g. 90 radicals -> 106 kanji) collapses to an unreadable
 * sliver unless nodeSep/rankSep are scaled to roughly match the canvas's aspect ratio.
 */
function computeSpacing(nodes: GraphNode[], width: number, height: number) {
  const perRank = new Map<number, number>();
  for (const node of nodes) {
    const rank = RANK_HINT[node.type];
    perRank.set(rank, (perRank.get(rank) ?? 0) + 1);
  }
  const maxPerRank = Math.max(1, ...perRank.values());
  const rankGaps = Math.max(1, perRank.size - 1);

  const nodeSep = clamp(height / maxPerRank, 8, 45);
  const rankSep = clamp(width / rankGaps, 60, 900);
  return { nodeSep, rankSep };
}

type Props = {
  nodes: GraphNode[];
  edges: GraphEdgeOut[];
  centerKey?: string;
  height?: number;
};

export function DependencyGraph({ nodes, edges, centerKey, height = 420 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    ensureDagreRegistered();
    if (!containerRef.current) return;

    const elements: ElementDefinition[] = [
      ...nodes.map((node) => ({
        data: {
          id: nodeKey(node.type, node.slug),
          label: node.primaryForm || node.slug,
          type: node.type,
          slug: node.slug,
          missing: node.missing,
          completeness: node.completeness ?? 0,
          isCenter: nodeKey(node.type, node.slug) === centerKey,
        },
      })),
      ...edges.map((edge) => ({
        data: {
          id: `${nodeKey(edge.fromType, edge.fromSlug)}->${nodeKey(edge.toType, edge.toSlug)}:${edge.relationship}`,
          source: nodeKey(edge.fromType, edge.fromSlug),
          target: nodeKey(edge.toType, edge.toSlug),
          relationship: edge.relationship,
        },
      })),
    ];

    const dense = nodes.length > 120;

    const style: StylesheetJson = [
      {
        selector: 'node',
        style: {
          'background-color': (ele: cytoscape.NodeSingular) =>
            TYPE_COLORS[ele.data('type') as ContentType] ?? '#888',
          opacity: (ele: cytoscape.NodeSingular) =>
            ele.data('missing') ? 0.35 : 0.35 + (ele.data('completeness') as number) * 0.65,
          label: dense ? '' : 'data(label)',
          'font-size': 9,
          color: '#e8eaed',
          'text-outline-width': 2,
          'text-outline-color': '#0f1115',
          width: dense ? 10 : 20,
          height: dense ? 10 : 20,
        },
      },
      {
        selector: 'node[?missing]',
        style: {
          'border-width': 2,
          'border-color': '#f7768e',
          'border-style': 'dashed',
        },
      },
      {
        selector: 'node[?isCenter]',
        style: {
          'border-width': 3,
          'border-color': '#e8eaed',
          width: 30,
          height: 30,
        },
      },
      {
        selector: 'edge',
        style: {
          width: 1,
          'line-color': '#2a2f3a',
          'target-arrow-color': '#2a2f3a',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 0.7,
          'curve-style': 'bezier',
          opacity: 0.55,
        },
      },
    ];

    const { width: containerWidth, height: containerHeight } =
      containerRef.current.getBoundingClientRect();
    const { nodeSep, rankSep } = computeSpacing(nodes, containerWidth, containerHeight);

    const cy: Core = cytoscape({
      container: containerRef.current,
      elements,
      style,
      layout: {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep,
        rankSep,
        fit: true,
        padding: 20,
      } as cytoscape.LayoutOptions,
    });

    cy.on('tap', 'node', (evt) => {
      const data = evt.target.data() as { type: ContentType; slug: string; missing: boolean };
      if (data.missing) return;
      navigate(`/content/${data.type}/${data.slug}`);
    });

    return () => {
      cy.destroy();
    };
  }, [nodes, edges, centerKey, navigate]);

  return <div ref={containerRef} className="graph-canvas" style={{ height }} />;
}

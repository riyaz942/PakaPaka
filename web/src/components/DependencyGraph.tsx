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

/** How far below the initial fit zoom the user may zoom out. */
const MIN_ZOOM_FIT_RATIO = 0.85;
/** Absolute floor so dense graphs still have a sensible min zoom. */
const MIN_ZOOM_FLOOR = 0.08;
/** Max zoom as a multiple of the fitted zoom — keep zoom-in modest. */
const MAX_ZOOM_FIT_RATIO = 1.4;

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

  const nodeSep = clamp(height / maxPerRank, 18, 56);
  const rankSep = clamp(width / rankGaps, 90, 900);
  return { nodeSep, rankSep };
}

/**
 * Keep graph content inside the canvas:
 * - If content fits, lock it centered (no empty-side panning).
 * - If zoomed in, clamp so the viewport never leaves the content bounds.
 */
function constrainPan(cy: Core) {
  const nodes = cy.nodes();
  if (nodes.empty()) return;

  const bb = nodes.renderedBoundingBox({
    includeLabels: true,
    includeOverlays: false,
  });
  if (!Number.isFinite(bb.w) || bb.w <= 0 || !Number.isFinite(bb.h) || bb.h <= 0) return;

  const pan = cy.pan();
  const cw = cy.width();
  const ch = cy.height();
  let dx = 0;
  let dy = 0;

  if (bb.w <= cw) {
    dx = (cw - bb.w) / 2 - bb.x1;
  } else if (bb.x1 > 0) {
    dx = -bb.x1;
  } else if (bb.x2 < cw) {
    dx = cw - bb.x2;
  }

  if (bb.h <= ch) {
    dy = (ch - bb.h) / 2 - bb.y1;
  } else if (bb.y1 > 0) {
    dy = -bb.y1;
  } else if (bb.y2 < ch) {
    dy = ch - bb.y2;
  }

  if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
    cy.pan({ x: pan.x + dx, y: pan.y + dy });
  }
}

function applyZoomLimitsFromFit(cy: Core) {
  const fitZoom = cy.zoom();
  cy.minZoom(Math.max(MIN_ZOOM_FLOOR, fitZoom * MIN_ZOOM_FIT_RATIO));
  cy.maxZoom(fitZoom * MAX_ZOOM_FIT_RATIO);
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

    const dense = nodes.length > 180;
    const nodeSize = dense ? 28 : 40;
    const labelSize = dense ? 13 : 18;

    const style: StylesheetJson = [
      {
        selector: 'node',
        style: {
          'background-color': (ele: cytoscape.NodeSingular) =>
            TYPE_COLORS[ele.data('type') as ContentType] ?? '#888',
          opacity: (ele: cytoscape.NodeSingular) =>
            ele.data('missing') ? 0.4 : 0.45 + (ele.data('completeness') as number) * 0.55,
          label: 'data(label)',
          'font-size': labelSize,
          'font-family':
            'Hiragino Sans, Hiragino Kaku Gothic ProN, Noto Sans JP, Yu Gothic, sans-serif',
          'font-weight': 600,
          color: '#e8eaed',
          'text-valign': 'center',
          'text-halign': 'center',
          'text-outline-width': 3,
          'text-outline-color': '#0f1115',
          'text-wrap': 'none',
          width: nodeSize,
          height: nodeSize,
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
          width: nodeSize + 12,
          height: nodeSize + 12,
          'font-size': labelSize + 2,
        },
      },
      {
        selector: 'edge',
        style: {
          width: dense ? 2 : 2.5,
          'line-color': '#5a6270',
          'target-arrow-color': '#5a6270',
          'target-arrow-shape': 'triangle',
          'arrow-scale': 1.1,
          'curve-style': 'bezier',
          opacity: 0.75,
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
      // Wide range during layout fit; tightened in layoutstop.
      minZoom: MIN_ZOOM_FLOOR,
      maxZoom: 20,
      layout: {
        name: 'dagre',
        rankDir: 'LR',
        nodeSep,
        rankSep,
        fit: true,
        padding: 20,
      } as cytoscape.LayoutOptions,
    });

    let constraining = false;
    const onViewport = () => {
      if (constraining) return;
      constraining = true;
      try {
        constrainPan(cy);
      } finally {
        constraining = false;
      }
    };

    cy.one('layoutstop', () => {
      applyZoomLimitsFromFit(cy);
      constraining = true;
      try {
        constrainPan(cy);
      } finally {
        constraining = false;
      }
      cy.on('viewport', onViewport);
    });

    cy.on('tap', 'node', (evt) => {
      const data = evt.target.data() as { type: ContentType; slug: string; missing: boolean };
      if (data.missing) return;
      navigate(`/content/${data.type}/${data.slug}`);
    });

    return () => {
      cy.off('viewport', onViewport);
      cy.destroy();
    };
  }, [nodes, edges, centerKey, navigate]);

  return <div ref={containerRef} className="graph-canvas" style={{ height }} />;
}

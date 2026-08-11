import { useApi } from '../hooks/useApi';
import type { ContentType, GraphNeighborhoodResponse } from '../types/api';
import { DependencyGraph } from './DependencyGraph';

type Props = {
  type: ContentType;
  slug: string;
};

export function ItemNeighborhoodGraph({ type, slug }: Props) {
  const result = useApi<GraphNeighborhoodResponse>(
    `/api/graph/neighborhood?type=${type}&slug=${encodeURIComponent(slug)}&depth=1`,
  );

  if (result.status === 'loading') {
    return (
      <div className="panel">
        <h2 className="panel-title">Neighborhood</h2>
        <p className="panel-muted">Loading…</p>
      </div>
    );
  }

  if (result.status === 'error') {
    return (
      <div className="panel">
        <h2 className="panel-title">Neighborhood</h2>
        <p className="panel-error">Failed to load: {result.error}</p>
      </div>
    );
  }

  const { center, nodes, edges } = result.data;
  if (nodes.length <= 1) {
    return (
      <div className="panel">
        <h2 className="panel-title">Neighborhood</h2>
        <p className="panel-muted">No connected items in the dependency graph.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <h2 className="panel-title">Neighborhood</h2>
      <DependencyGraph
        nodes={nodes}
        edges={edges}
        centerKey={`${center.type}:${center.slug}`}
        height={360}
      />
    </div>
  );
}

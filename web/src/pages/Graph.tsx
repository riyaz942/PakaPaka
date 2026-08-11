import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { DependencyGraph } from '../components/DependencyGraph';
import { useApi } from '../hooks/useApi';
import {
  CONTENT_TYPE_LABELS,
  type BuildOrderRow,
  type ContentType,
  type GraphLevelResponse,
  type GraphSummaryResponse,
  type JlptLevel,
} from '../types/api';

const GRAPH_TYPES: ContentType[] = ['radical', 'kanji', 'vocabulary', 'grammar'];
const LEVELS: JlptLevel[] = ['N5', 'N4'];

const REASON_LABELS: Record<string, string> = {
  missing: 'missing',
  draft: 'draft',
  skeleton: 'skeleton',
};

export default function Graph() {
  const [level, setLevel] = useState<JlptLevel>('N5');
  const [activeTypes, setActiveTypes] = useState<Set<ContentType>>(
    () => new Set<ContentType>(['radical', 'kanji']),
  );

  const levelData = useApi<GraphLevelResponse>(`/api/graph/level/${level}`);
  const summary = useApi<GraphSummaryResponse>('/api/graph/summary');
  const buildOrder = useApi<BuildOrderRow[]>(`/api/graph/build-order?level=${level}`);

  const filtered = useMemo(() => {
    if (levelData.status !== 'ok') return null;
    const nodes = levelData.data.nodes.filter((n) => activeTypes.has(n.type));
    const keys = new Set(nodes.map((n) => `${n.type}:${n.slug}`));
    const edges = levelData.data.edges.filter(
      (e) => keys.has(`${e.fromType}:${e.fromSlug}`) && keys.has(`${e.toType}:${e.toSlug}`),
    );
    return { nodes, edges };
  }, [levelData, activeTypes]);

  function toggleType(type: ContentType) {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  return (
    <div className="graph-page">
      <section className="panel">
        <h2 className="dashboard-title">Dependency graph</h2>
        <p className="dashboard-sub">
          Radical → kanji → vocabulary / grammar dependency graph. Node opacity reflects
          completeness; a dashed red border marks a dangling reference. Click a node to open it.
        </p>
        <div className="filter-bar">
          <div className="chip-group">
            {LEVELS.map((lv) => (
              <button
                key={lv}
                type="button"
                className={lv === level ? 'chip chip--active' : 'chip'}
                onClick={() => setLevel(lv)}
              >
                {lv}
              </button>
            ))}
          </div>
          <div className="chip-group">
            {GRAPH_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={activeTypes.has(type) ? 'chip chip--active' : 'chip'}
                onClick={() => toggleType(type)}
              >
                {CONTENT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {levelData.status === 'loading' ? <p className="panel-muted">Loading graph…</p> : null}
        {levelData.status === 'error' ? (
          <p className="panel-error">Failed to load graph: {levelData.error}</p>
        ) : null}
        {filtered ? (
          filtered.nodes.length === 0 ? (
            <p className="panel-muted">No nodes for this filter.</p>
          ) : (
            <>
              <DependencyGraph nodes={filtered.nodes} edges={filtered.edges} height={560} />
              <p className="panel-muted graph-page__stats">
                {filtered.nodes.length} node(s), {filtered.edges.length} edge(s) shown
              </p>
            </>
          )
        ) : null}
      </section>

      <section className="panel">
        <h2 className="panel-title">Graph summary</h2>
        {summary.status === 'loading' ? <p className="panel-muted">Loading…</p> : null}
        {summary.status === 'error' ? (
          <p className="panel-error">Failed to load summary: {summary.error}</p>
        ) : null}
        {summary.status === 'ok' ? (
          <>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Relationship</th>
                    <th className="num">Edges</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.data.edgeTypeCounts.map((row) => (
                    <tr key={`${row.fromType}-${row.toType}-${row.relationship}`}>
                      <td>{CONTENT_TYPE_LABELS[row.fromType]}</td>
                      <td>{CONTENT_TYPE_LABELS[row.toType]}</td>
                      <td>{row.relationship}</td>
                      <td className="num">{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="panel-muted graph-page__stats">
              {summary.data.totalEdges} total edge(s) · {summary.data.orphans.length} orphan
              item(s) · {summary.data.dangling.length} dangling edge(s)
            </p>
            {summary.data.orphans.length > 0 ? (
              <div className="chip-row">
                {summary.data.orphans.slice(0, 60).map((orphan) => (
                  <Link
                    key={`${orphan.type}:${orphan.slug}`}
                    to={`/content/${orphan.type}/${orphan.slug}`}
                    className="related-chip"
                  >
                    {orphan.primaryForm || orphan.slug}
                  </Link>
                ))}
                {summary.data.orphans.length > 60 ? (
                  <span className="related-chip related-chip--static">
                    +{summary.data.orphans.length - 60} more
                  </span>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      <section className="panel">
        <h2 className="panel-title">Build order — finish these first</h2>
        <p className="panel-muted">
          {level} items whose prerequisites are missing, still a draft, or a skeleton, sorted by
          how many downstream items they unblock.
        </p>
        {buildOrder.status === 'loading' ? <p className="panel-muted">Loading…</p> : null}
        {buildOrder.status === 'error' ? (
          <p className="panel-error">Failed to load build order: {buildOrder.error}</p>
        ) : null}
        {buildOrder.status === 'ok' ? (
          buildOrder.data.length === 0 ? (
            <p className="panel-muted">Nothing blocked for {level}.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Type</th>
                    <th className="num">Unblocks</th>
                    <th>Blocked by</th>
                  </tr>
                </thead>
                <tbody>
                  {buildOrder.data.slice(0, 100).map((row) => (
                    <tr key={`${row.type}:${row.slug}`}>
                      <td>
                        <Link to={`/content/${row.type}/${row.slug}`} className="row-link">
                          {row.primaryForm || row.slug}
                        </Link>
                      </td>
                      <td>{CONTENT_TYPE_LABELS[row.type]}</td>
                      <td className="num">{row.outDegree}</td>
                      <td>
                        <div className="chip-row">
                          {row.blockedBy.map((blocker, i) =>
                            blocker.type ? (
                              <Link
                                key={`${blocker.slug}-${i}`}
                                to={`/content/${blocker.type}/${blocker.slug}`}
                                className="related-chip"
                              >
                                {blocker.primaryForm || blocker.slug} (
                                {blocker.reasons.map((r) => REASON_LABELS[r]).join(', ')})
                              </Link>
                            ) : (
                              <span
                                key={`${blocker.slug}-${i}`}
                                className="related-chip related-chip--static"
                              >
                                {blocker.slug} ({blocker.reasons.map((r) => REASON_LABELS[r]).join(', ')})
                              </span>
                            ),
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {buildOrder.data.length > 100 ? (
                <p className="panel-muted graph-page__stats">
                  Showing top 100 of {buildOrder.data.length}
                </p>
              ) : null}
            </div>
          )
        ) : null}
      </section>
    </div>
  );
}

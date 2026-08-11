import { Link } from 'react-router-dom';
import { CONTENT_TYPE_LABELS, type DependencySummary } from '../types/api';

type Props = {
  dependencySummary: DependencySummary;
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  requires: 'requires',
  builds_on: 'builds on',
  reinforces: 'reinforces',
};

export function DependencyPanel({ dependencySummary }: Props) {
  const { incoming, outgoing } = dependencySummary;

  return (
    <div className="panel">
      <h2 className="panel-title">Dependencies</h2>
      <div className="dependency-columns">
        <div>
          <h3 className="dependency-subtitle">Built from</h3>
          {incoming.length === 0 ? (
            <p className="panel-muted">No prerequisites.</p>
          ) : (
            <ul className="dependency-list">
              {incoming.map((ref) => (
                <li key={`${ref.type}:${ref.slug}`}>
                  <Link to={`/content/${ref.type}/${ref.slug}`} className="related-chip">
                    {ref.primaryForm || ref.slug}
                  </Link>
                  <span className="dependency-meta">
                    {CONTENT_TYPE_LABELS[ref.type]} · {RELATIONSHIP_LABELS[ref.relationship] ?? ref.relationship}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="dependency-subtitle">Unlocks</h3>
          {outgoing.length === 0 ? (
            <p className="panel-muted">Nothing depends on this yet.</p>
          ) : (
            <ul className="dependency-list">
              {outgoing.map((ref) => (
                <li key={`${ref.type}:${ref.slug}`}>
                  <Link to={`/content/${ref.type}/${ref.slug}`} className="related-chip">
                    {ref.primaryForm || ref.slug}
                  </Link>
                  <span className="dependency-meta">
                    {CONTENT_TYPE_LABELS[ref.type]} · {RELATIONSHIP_LABELS[ref.relationship] ?? ref.relationship}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

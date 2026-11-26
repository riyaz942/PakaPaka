import { useState } from 'react';
import { StatusBadge } from '../components/StatusBadge';
import { useApi } from '../hooks/useApi';
import { ReadingDetail } from './detail/ReadingDetail';
import type { ReadingRaw } from '../types/curriculumRaw';
import type { GeneratedResponse, GeneratedSeedRow, Level } from '../types/api';

function ToneTag({ tone }: { tone: string }) {
  return (
    <span className={tone === 'humorous' ? 'tone-tag tone-tag--humorous' : 'tone-tag'}>
      {tone}
    </span>
  );
}

function SeedRow({
  row,
  expanded,
  onToggle,
  showReadings,
}: {
  row: GeneratedSeedRow;
  expanded: boolean;
  onToggle: () => void;
  showReadings: boolean;
}) {
  const [lo, hi] = row.targetWords;
  const generated = row.passage !== null;

  return (
    <>
      <tr className={generated ? undefined : 'seed-row--pending'}>
        <td className="row-number-column panel-muted">{row.position}</td>
        <td>
          {generated ? (
            <button
              type="button"
              className="row-link seed-toggle"
              onClick={onToggle}
              aria-expanded={expanded}
            >
              {expanded ? '▾' : '▸'} {row.seed}
            </button>
          ) : (
            <span className="panel-muted">{row.seed}</span>
          )}
        </td>
        <td>
          <ToneTag tone={row.tone} />
        </td>
        <td className="num">
          {row.wordCount ?? <span className="panel-muted">—</span>}
          <span className="panel-muted seed-band">
            {' '}
            /{lo}–{hi}
          </span>
        </td>
        <td className="num">{row.questionCount}</td>
        <td>
          {generated ? (
            <StatusBadge status={row.meta?.review_status ?? 'none'} />
          ) : (
            <span className="panel-muted">pending</span>
          )}
        </td>
        <td>{row.meta?.generator_model ?? <span className="panel-muted">—</span>}</td>
      </tr>
      {expanded && row.passage ? (
        <tr>
          <td colSpan={7} className="seed-row__expansion">
            <p className="panel-muted seed-topic">{row.topic}</p>
            <ReadingDetail raw={row.passage as unknown as ReadingRaw} showReadings={showReadings} />
          </td>
        </tr>
      ) : null}
    </>
  );
}

export default function Generated() {
  const [level, setLevel] = useState<Level | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showReadings, setShowReadings] = useState(true);
  const [pendingHidden, setPendingHidden] = useState(false);

  const state = useApi<GeneratedResponse>('/api/generated');

  // A few seeds per level — small enough that filtering on every render is
  // cheaper than memoising it.
  const levels = state.status === 'ok' ? state.data.levels : [];
  const active = levels.find((l) => l.level === level) ?? levels[0] ?? null;
  const rows = active
    ? active.rows.filter((row) => !pendingHidden || row.passage !== null)
    : [];

  return (
    <div className="content-list">
      <section className="panel">
        <h2 className="dashboard-title">Generated passages</h2>
        <p className="dashboard-sub">
          The Phase 4 build artifact at{' '}
          <code>curriculum/_build/generate_content/passages/</code>, joined onto the seed ladder in{' '}
          <code>reading_seeds.py</code>. This is <strong>not shipped content</strong> — it reaches the
          app only after a human reads the whole level and performs the wire-in. Read-only here.
        </p>
      </section>

      {state.status === 'loading' ? <p className="panel-muted">Loading seeds…</p> : null}
      {state.status === 'error' ? (
        <p className="panel-error">Failed to load generated passages: {state.error}</p>
      ) : null}

      {active ? (
        <>
          <div className="tabs" role="tablist" aria-label="Level">
            {levels.map((l) => (
              <button
                key={l.level}
                type="button"
                role="tab"
                aria-selected={l.level === active.level}
                className={l.level === active.level ? 'tab tab--active' : 'tab'}
                onClick={() => {
                  setLevel(l.level);
                  setExpanded(null);
                }}
              >
                Level {l.level} <span className="panel-muted">{l.generated}/{l.total}</span>
              </button>
            ))}
          </div>

          <div className="filter-bar">
            <p className="panel-muted">
              {active.generated} of {active.total} seeds generated —{' '}
              {active.total - active.generated} still pending
            </p>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={pendingHidden}
                onChange={(e) => setPendingHidden(e.target.checked)}
              />
              Hide pending seeds
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={showReadings}
                onChange={(e) => setShowReadings(e.target.checked)}
              />
              Show furigana readings
            </label>
          </div>

          {rows.length === 0 ? (
            <p className="panel-muted">
              No passages generated for level {active.level} yet — run the reading-passage workflow, or
              untick “Hide pending seeds” to see the {active.total} seeds waiting.
            </p>
          ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="row-number-column" />
                  <th>Seed</th>
                  <th>Tone</th>
                  <th>Words</th>
                  <th>Qs</th>
                  <th>Status</th>
                  <th>Model</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <SeedRow
                    key={row.seed}
                    row={row}
                    expanded={expanded === row.seed}
                    onToggle={() => setExpanded(expanded === row.seed ? null : row.seed)}
                    showReadings={showReadings}
                  />
                ))}
              </tbody>
            </table>
          </div>
          )}
        </>
      ) : null}
    </div>
  );
}

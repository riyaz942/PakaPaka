import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { SeverityBadge } from '../components/SeverityBadge';
import { useApi } from '../hooks/useApi';
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  type AuditFindingsResponse,
  type AuditSummary,
  type ContentType,
  type FindingSeverity,
} from '../types/api';

const SEVERITY_OPTIONS: Array<FindingSeverity | ''> = ['', 'ERROR', 'WARNING', 'INFO'];

function formatLastRun(iso: string | null): string {
  if (!iso) return 'never';
  const date = new Date(iso);
  return date.toLocaleString();
}

export default function Audit() {
  const [severity, setSeverity] = useState<FindingSeverity | ''>('');
  const [type, setType] = useState<ContentType | ''>('');
  const [runToken, setRunToken] = useState(0);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);

  const summary = useApi<AuditSummary>(`/api/audit/summary?r=${runToken}`);

  const findingsUrl = useMemo(() => {
    const qs = new URLSearchParams();
    if (severity) qs.set('severity', severity);
    if (type) qs.set('type', type);
    qs.set('r', String(runToken));
    return `/api/audit/findings?${qs.toString()}`;
  }, [severity, type, runToken]);

  const findings = useApi<AuditFindingsResponse>(findingsUrl);

  async function handleRunAudit() {
    setRunning(true);
    setRunError(null);
    try {
      const res = await fetch('/api/audit/run', { method: 'POST' });
      const body = (await res.json()) as { ok: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setRunError(body.error ?? 'Audit run failed');
      }
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Audit run failed');
    } finally {
      setRunning(false);
      setRunToken((t) => t + 1);
    }
  }

  const grouped = useMemo(() => {
    if (findings.status !== 'ok') return [];
    const map = new Map<string, typeof findings.data.findings>();
    for (const finding of findings.data.findings) {
      const bucket = map.get(finding.check);
      if (bucket) bucket.push(finding);
      else map.set(finding.check, [finding]);
    }
    return [...map.entries()];
  }, [findings]);

  return (
    <div className="audit-page">
      <section className="audit-hero panel">
        <div>
          <h2 className="dashboard-title">Content audit</h2>
          <p className="dashboard-sub">
            Re-runs <code>audit_shipped.py</code> (tiers 0-1 deterministic checks) against the
            shipped curriculum JSON. Takes a few minutes for both levels.
          </p>
          {summary.status === 'ok' ? (
            <>
              <p className="panel-muted">Last run: {formatLastRun(summary.data.lastRunAt)}</p>
              <div className="audit-totals">
                <SeverityBadge severity="ERROR" count={summary.data.totals.ERROR} />
                <SeverityBadge severity="WARNING" count={summary.data.totals.WARNING} />
                <SeverityBadge severity="INFO" count={summary.data.totals.INFO} />
              </div>
            </>
          ) : null}
          {runError ? <p className="panel-error">{runError}</p> : null}
        </div>
        <button
          type="button"
          className="audit-run-button"
          onClick={handleRunAudit}
          disabled={running}
        >
          {running ? 'Running audit…' : 'Run audit'}
        </button>
      </section>

      <section className="panel">
        <div className="filter-bar">
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as FindingSeverity | '')}
            aria-label="Severity"
          >
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'All severities'}
              </option>
            ))}
          </select>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ContentType | '')}
            aria-label="Content type"
          >
            <option value="">All types</option>
            {CONTENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CONTENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>

        {findings.status === 'loading' ? <p className="panel-muted">Loading findings…</p> : null}
        {findings.status === 'error' ? (
          <p className="panel-error">Failed to load findings: {findings.error}</p>
        ) : null}
        {findings.status === 'ok' ? (
          <>
            <p className="panel-muted">{findings.data.total} finding(s)</p>
            <div className="draft-groups">
              {grouped.map(([check, rows]) => (
                <article key={check} className="audit-check-group">
                  <header className="audit-check-group__head">
                    <span className="audit-check-group__title">{check}</span>
                    <span className="draft-group__count">
                      {rows.length} finding{rows.length === 1 ? '' : 's'}
                    </span>
                  </header>
                  <ul className="audit-finding-list">
                    {rows.map((finding, i) => (
                      <li key={`${check}-${i}`} className="audit-finding">
                        <div className="audit-finding__head">
                          <SeverityBadge severity={finding.severity} />
                          <span className="audit-finding__check">{finding.level}</span>
                        </div>
                        <p className="audit-finding__message">{finding.message}</p>
                        {finding.links.length > 0 ? (
                          <div className="audit-finding-row__slugs">
                            {finding.links.map((link) =>
                              link.type ? (
                                <Link
                                  key={link.slug}
                                  to={`/content/${link.type}/${link.slug}?highlight=${encodeURIComponent(finding.message)}`}
                                  className="related-chip"
                                >
                                  {link.slug}
                                </Link>
                              ) : (
                                <span key={link.slug} className="related-chip related-chip--static">
                                  {link.slug}
                                </span>
                              ),
                            )}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

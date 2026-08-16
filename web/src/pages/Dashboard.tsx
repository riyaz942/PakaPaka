import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BadgeLegend } from '../components/BadgeLegend';
import { CompletenessPill } from '../components/CompletenessPill';
import { StatusBadge } from '../components/StatusBadge';
import { useApi } from '../hooks/useApi';
import { guideHref, stageIdForTypeGap } from '../lib/guide';
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  STATUS_LABELS,
  type ContentListItem,
  type ContentType,
  type GapsResponse,
  type ItemsResponse,
  type JlptLevel,
  type OverviewResponse,
  type ReviewStatus,
} from '../types/api';

const STATUS_COLORS: Record<ReviewStatus, string> = {
  draft: '#e0af68',
  reviewed: '#9ece6a',
  flagged_for_rewrite: '#f7768e',
  none: '#565f89',
};

const LEVELS: JlptLevel[] = ['N5', 'N4'];

type DraftGroup = {
  key: string;
  promptVersion: string;
  generatorModel: string;
  count: number;
  samples: ContentListItem[];
};

function comparePromptVersion(a: string, b: string): number {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return nb - na;
  return b.localeCompare(a);
}

async function fetchAllDrafts(): Promise<ContentListItem[]> {
  const res = await fetch('/api/items?status=draft&sort=slug');
  if (!res.ok) {
    throw new Error(await res.text());
  }
  const body = (await res.json()) as ItemsResponse;
  return body.items;
}

function groupDrafts(items: ContentListItem[]): DraftGroup[] {
  const map = new Map<string, DraftGroup>();

  for (const item of items) {
    const promptVersion = item.meta?.prompt_version ?? '(none)';
    const generatorModel = item.meta?.generator_model ?? '(none)';
    const key = `${promptVersion}::${generatorModel}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      if (existing.samples.length < 5) {
        existing.samples.push(item);
      }
    } else {
      map.set(key, {
        key,
        promptVersion,
        generatorModel,
        count: 1,
        samples: [item],
      });
    }
  }

  return [...map.values()].sort((a, b) => {
    const byVersion = comparePromptVersion(a.promptVersion, b.promptVersion);
    if (byVersion !== 0) return byVersion;
    return a.generatorModel.localeCompare(b.generatorModel);
  });
}

function useDraftGroups(): {
  status: 'loading' | 'error' | 'ok';
  groups: DraftGroup[];
  total: number;
  error: string | null;
} {
  const [status, setStatus] = useState<'loading' | 'error' | 'ok'>('loading');
  const [groups, setGroups] = useState<DraftGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);

    fetchAllDrafts()
      .then((items) => {
        if (cancelled) return;
        setGroups(groupDrafts(items));
        setTotal(items.length);
        setStatus('ok');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to load drafts');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { status, groups, total, error };
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      {label ? <div className="chart-tooltip__label">{label}</div> : null}
      {payload.map((entry) => (
        <div key={entry.name} className="chart-tooltip__row">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <strong>{entry.value}</strong>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const overview = useApi<OverviewResponse>('/api/overview');
  const gapsResult = useApi<GapsResponse>('/api/gaps');
  const drafts = useDraftGroups();

  // Per-field missing counts, so a completeness link points at the stage that
  // actually owns the hole rather than the first stage touching the type.
  const missingByType = useMemo(() => {
    const out = {} as Record<ContentType, { all: Record<string, number>; byLevel: Record<JlptLevel, Record<string, number>> }>;
    if (gapsResult.status !== 'ok') return out;
    for (const type of CONTENT_TYPES) {
      const all: Record<string, number> = {};
      const byLevel = {} as Record<JlptLevel, Record<string, number>>;
      for (const level of LEVELS) {
        const bucket = gapsResult.data.byTypeLevel[type][level];
        byLevel[level] = bucket.missing;
        for (const [field, count] of Object.entries(bucket.missing)) {
          all[field] = (all[field] ?? 0) + count;
        }
      }
      out[type] = { all, byLevel };
    }
    return out;
  }, [gapsResult]);

  const statusBarData = useMemo(() => {
    if (overview.status !== 'ok') return [];
    const rows: Array<{
      label: string;
      draft: number;
      reviewed: number;
      flagged_for_rewrite: number;
      none: number;
    }> = [];

    for (const type of CONTENT_TYPES) {
      for (const level of LEVELS) {
        const bucket = overview.data.byTypeLevel[type][level];
        rows.push({
          label: `${CONTENT_TYPE_LABELS[type]} ${level}`,
          draft: bucket.status.draft,
          reviewed: bucket.status.reviewed,
          flagged_for_rewrite: bucket.status.flagged_for_rewrite,
          none: bucket.status.none,
        });
      }
    }
    return rows;
  }, [overview]);

  const donutData = useMemo(() => {
    if (overview.status !== 'ok') return [];
    const totals: Record<ReviewStatus, number> = {
      draft: 0,
      reviewed: 0,
      flagged_for_rewrite: 0,
      none: 0,
    };
    for (const type of CONTENT_TYPES) {
      for (const level of LEVELS) {
        const status = overview.data.byTypeLevel[type][level].status;
        totals.draft += status.draft;
        totals.reviewed += status.reviewed;
        totals.flagged_for_rewrite += status.flagged_for_rewrite;
        totals.none += status.none;
      }
    }
    return (Object.keys(totals) as ReviewStatus[])
      .map((status) => ({
        name: STATUS_LABELS[status],
        status,
        value: totals[status],
      }))
      .filter((row) => row.value > 0);
  }, [overview]);

  const completenessData = useMemo(() => {
    if (overview.status !== 'ok') return [];
    return CONTENT_TYPES.map((type) => {
      let total = 0;
      let weighted = 0;
      let skeletons = 0;
      for (const level of LEVELS) {
        const bucket = overview.data.byTypeLevel[type][level];
        total += bucket.total;
        weighted += bucket.meanCompleteness * bucket.total;
        skeletons += bucket.skeletonCount;
      }
      return {
        type,
        label: CONTENT_TYPE_LABELS[type],
        mean: total === 0 ? 0 : weighted / total,
        skeletonCount: skeletons,
        total,
      };
    });
  }, [overview]);

  if (overview.status === 'loading') {
    return <p className="panel-muted">Loading overview…</p>;
  }

  if (overview.status === 'error') {
    return (
      <p className="panel-error">Failed to load overview: {overview.error}</p>
    );
  }

  const { data } = overview;

  return (
    <div className="dashboard">
      <section className="dashboard-hero">
        <div>
          <h2 className="dashboard-title">God&apos;s eye view</h2>
          <p className="dashboard-sub">
            Corpus {data.metadata.version} · {data.totals.total_items} items ·{' '}
            {data.totals.reading_passages} passages ·{' '}
            {data.totals.dependency_edges} edges
          </p>
          <BadgeLegend skeletonLabel={data.skeletonLabel} showAudit={false} />
        </div>
        <Link to="/guide" className="audit-run-button">
          How content gets made →
        </Link>
      </section>

      <div className="dashboard-grid">
        <section className="panel panel--wide">
          <h3 className="panel-title">Review status by type × level</h3>
          <div className="chart-box chart-box--tall">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={statusBarData}
                margin={{ top: 8, right: 8, left: 0, bottom: 48 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis
                  dataKey="label"
                  angle={-35}
                  textAnchor="end"
                  interval={0}
                  tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
                />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Bar
                  dataKey="draft"
                  name="Draft"
                  stackId="status"
                  fill={STATUS_COLORS.draft}
                />
                <Bar
                  dataKey="reviewed"
                  name="Reviewed"
                  stackId="status"
                  fill={STATUS_COLORS.reviewed}
                />
                <Bar
                  dataKey="flagged_for_rewrite"
                  name="Flagged"
                  stackId="status"
                  fill={STATUS_COLORS.flagged_for_rewrite}
                />
                <Bar
                  dataKey="none"
                  name="None"
                  stackId="status"
                  fill={STATUS_COLORS.none}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel">
          <h3 className="panel-title">Overall review status</h3>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={2}
                >
                  {donutData.map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={STATUS_COLORS[entry.status]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ChartTooltip />} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="panel panel--wide">
          <h3 className="panel-title">
            Completeness by type{' '}
            <span className="panel-title-hint">({data.skeletonLabel})</span>
          </h3>
          <p className="panel-muted">
            Click a percentage to see what fills the missing fields.
          </p>
          <div className="completeness-list">
            {completenessData.map((row) => {
              const stageId = stageIdForTypeGap(row.type, missingByType[row.type]?.all);
              return (
              <div key={row.type} className="completeness-row">
                <div className="completeness-row__head">
                  <span className="completeness-row__label">{row.label}</span>
                  <div className="completeness-row__meta">
                    <CompletenessPill
                      percent={row.mean}
                      skeleton={row.skeletonCount > 0}
                      skeletonLabel={data.skeletonLabel}
                      href={stageId ? guideHref(`stage-${stageId}`) : undefined}
                      title={`How to raise ${row.label} completeness`}
                    />
                    {row.skeletonCount > 0 ? (
                      <span
                        className="warning-badge"
                        title={data.skeletonLabel}
                      >
                        {row.skeletonCount} skeleton
                        {row.skeletonCount === 1 ? '' : 's'}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div
                  className="completeness-track"
                  role="progressbar"
                  aria-valuenow={Math.round(row.mean * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${row.label} mean completeness`}
                >
                  <div
                    className="completeness-track__fill"
                    style={{ width: `${Math.round(row.mean * 100)}%` }}
                  />
                </div>
              </div>
              );
            })}
          </div>
        </section>

        <section className="panel panel--wide">
          <h3 className="panel-title">Remaining to generate</h3>
          <p className="panel-muted">
            Targets from <code>web/targets.json</code> (edit by hand). Remaining
            = target − actual. Click a remaining count for the workflow that
            generates it.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Level</th>
                  <th className="num">Actual</th>
                  <th className="num">Target</th>
                  <th className="num">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {CONTENT_TYPES.flatMap((type: ContentType) =>
                  LEVELS.map((level) => {
                    const bucket = data.byTypeLevel[type][level];
                    const remainingClass =
                      bucket.remaining > 0
                        ? 'num remaining--open'
                        : bucket.remaining < 0
                          ? 'num remaining--over'
                          : 'num remaining--done';
                    const stageId = stageIdForTypeGap(
                      type,
                      missingByType[type]?.byLevel[level],
                    );
                    return (
                      <tr key={`${type}-${level}`}>
                        <td>{CONTENT_TYPE_LABELS[type]}</td>
                        <td>{level}</td>
                        <td className="num">{bucket.total}</td>
                        <td className="num">{bucket.target}</td>
                        <td className={remainingClass}>
                          {bucket.remaining > 0 && stageId ? (
                            <Link
                              to={guideHref(`stage-${stageId}`, level)}
                              className="remaining-link"
                              title={`How to generate the remaining ${level} ${CONTENT_TYPE_LABELS[type]}`}
                            >
                              {bucket.remaining}
                            </Link>
                          ) : (
                            bucket.remaining
                          )}
                        </td>
                      </tr>
                    );
                  }),
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel panel--wide">
          <h3 className="panel-title">Recently drafted</h3>
          <p className="panel-muted">
            No timestamps in the corpus — grouped by{' '}
            <code>_meta.prompt_version</code> + <code>generator_model</code>,
            newest prompt version first.
          </p>
          {drafts.status === 'loading' ? (
            <p className="panel-muted">Loading drafts…</p>
          ) : null}
          {drafts.status === 'error' ? (
            <p className="panel-error">{drafts.error}</p>
          ) : null}
          {drafts.status === 'ok' ? (
            <>
              <p className="panel-muted">{drafts.total} draft items total</p>
              <div className="draft-groups">
                {drafts.groups.map((group) => (
                  <article key={group.key} className="draft-group">
                    <header className="draft-group__head">
                      <div>
                        <strong>prompt v{group.promptVersion}</strong>
                        <span className="draft-group__model">
                          {group.generatorModel}
                        </span>
                      </div>
                      <span className="draft-group__count">
                        {group.count} item{group.count === 1 ? '' : 's'}
                      </span>
                    </header>
                    <ul className="draft-group__samples">
                      {group.samples.map((item) => (
                        <li key={`${item.type}:${item.slug}`}>
                          <span className="draft-sample__form">
                            {item.primaryForm}
                          </span>
                          <span className="draft-sample__slug">{item.slug}</span>
                          <StatusBadge status={item.reviewStatus} />
                          <CompletenessPill
                            percent={item.completeness.percent}
                            skeleton={item.completeness.percent < 0.6}
                            skeletonLabel={data.skeletonLabel}
                          />
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
    </div>
  );
}

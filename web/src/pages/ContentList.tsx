import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BadgeLegend } from '../components/BadgeLegend';
import { CompletenessPill } from '../components/CompletenessPill';
import { ReviewStatusControl } from '../components/ReviewStatusControl';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { useApi } from '../hooks/useApi';
import { guideHref, stageIdForField } from '../lib/guide';
import { listContextSearch } from '../lib/listContext';
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  MISSING_FIELD_OPTIONS,
  STATUS_LABELS,
  type ContentType,
  type FindingSeverity,
  type ItemsResponse,
  type JlptLevel,
  type ReviewStatus,
} from '../types/api';

const LEVEL_OPTIONS: Array<JlptLevel | ''> = ['', 'N5', 'N4'];
const STATUSES: ReviewStatus[] = ['draft', 'reviewed', 'flagged_for_rewrite', 'none'];
const AUDIT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '', label: 'Any audit status' },
  { value: 'any', label: 'Has audit issues' },
  { value: 'error', label: 'Audit: error' },
  { value: 'warning', label: 'Audit: warning' },
  { value: 'info', label: 'Audit: info' },
];
const PAGE_SIZE_STEP = 50;
const DEFAULT_PAGE_SIZE = PAGE_SIZE_STEP;
const SEARCH_DEBOUNCE_MS = 300;

function parsePageSize(value: string | null): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_PAGE_SIZE;
  return Math.floor(n);
}

/** 50, 100, … then the filtered total so the last choice shows everything. */
function buildPageSizeOptions(total: number): number[] {
  const options: number[] = [];
  for (let n = PAGE_SIZE_STEP; n < total; n += PAGE_SIZE_STEP) {
    options.push(n);
  }
  options.push(Math.max(PAGE_SIZE_STEP, total));
  return options;
}

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'sort_order', label: 'Sort order' },
  { value: 'completeness_asc', label: 'Completeness (low first)' },
  { value: 'slug', label: 'Slug' },
];

function isContentType(value: string | undefined): value is ContentType {
  return !!value && (CONTENT_TYPES as string[]).includes(value);
}

function SkeletonRows() {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Form</th>
            <th>Slug</th>
            <th>Meaning</th>
            <th>Level</th>
            <th>Status</th>
            <th>Completeness</th>
            <th>Audit</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, i) => (
            <tr key={i}>
              <td colSpan={7}>
                <span className="skeleton-bar" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ContentList() {
  const routeParams = useParams<{ type: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const type: ContentType = isContentType(routeParams.type)
    ? routeParams.type
    : 'radical';

  useEffect(() => {
    if (!isContentType(routeParams.type)) {
      navigate('/content/radical', { replace: true });
    }
  }, [routeParams.type, navigate]);

  const level = searchParams.get('level') ?? '';
  const status = searchParams.get('status') ?? '';
  const skeleton = searchParams.get('skeleton') === 'true';
  const missing = searchParams.get('missing') ?? '';
  const q = searchParams.get('q') ?? '';
  const audit = searchParams.get('audit') ?? '';
  const sort = searchParams.get('sort') ?? 'sort_order';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = parsePageSize(searchParams.get('pageSize'));

  const [searchInput, setSearchInput] = useState(q);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  const updateParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === '') {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      setSearchParams(next, { replace: false });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    const handle = setTimeout(() => {
      if (searchInput !== q) {
        updateParams({ q: searchInput || null, page: null });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const apiUrl = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set('type', type);
    if (level) qs.set('level', level);
    if (status) qs.set('status', status);
    if (skeleton) qs.set('skeleton', 'true');
    if (missing) qs.set('missing', missing);
    if (q) qs.set('q', q);
    if (audit) qs.set('audit', audit);
    qs.set('sort', sort);
    qs.set('page', String(page));
    qs.set('pageSize', String(pageSize));
    if (refreshToken) qs.set('r', String(refreshToken));
    return `/api/items?${qs.toString()}`;
  }, [type, level, status, skeleton, missing, q, audit, sort, page, pageSize, refreshToken]);

  const result = useApi<ItemsResponse>(apiUrl);
  const missingOptions = MISSING_FIELD_OPTIONS[type];
  const pageSizeOptions =
    result.status === 'ok' ? buildPageSizeOptions(result.data.total) : [DEFAULT_PAGE_SIZE];
  const effectivePageSize = pageSizeOptions.includes(pageSize)
    ? pageSize
    : pageSizeOptions[pageSizeOptions.length - 1];
  const totalPages =
    result.status === 'ok'
      ? Math.max(1, Math.ceil(result.data.total / effectivePageSize))
      : 1;
  const detailSearch = listContextSearch(searchParams);

  return (
    <div className="content-list">
      <div className="tabs" role="tablist" aria-label="Content type">
        {CONTENT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={t === type}
            className={t === type ? 'tab tab--active' : 'tab'}
            onClick={() => navigate(`/content/${t}`)}
          >
            {CONTENT_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="filter-bar">
        <div className="chip-group" role="group" aria-label="Level">
          {LEVEL_OPTIONS.map((lvl) => (
            <button
              key={lvl || 'all'}
              type="button"
              className={level === lvl ? 'chip chip--active' : 'chip'}
              onClick={() => updateParams({ level: lvl || null, page: null })}
            >
              {lvl || 'All'}
            </button>
          ))}
        </div>

        <select
          value={status}
          onChange={(e) => updateParams({ status: e.target.value || null, page: null })}
          aria-label="Review status"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <label className="checkbox-field">
          <input
            type="checkbox"
            checked={skeleton}
            onChange={(e) =>
              updateParams({ skeleton: e.target.checked ? 'true' : null, page: null })
            }
          />
          Skeleton only (&lt;60%)
        </label>

        <select
          value={missing}
          onChange={(e) => updateParams({ missing: e.target.value || null, page: null })}
          aria-label="Missing field"
        >
          <option value="">Any completeness</option>
          {missingOptions.map((field) => (
            <option key={field} value={field}>
              Missing {field}
            </option>
          ))}
        </select>

        <input
          type="search"
          className="search-input"
          placeholder="Search slug, form, meaning…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          aria-label="Search"
        />

        <select
          value={audit}
          onChange={(e) => updateParams({ audit: e.target.value || null, page: null })}
          aria-label="Audit status"
        >
          {AUDIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value, page: null })}
          aria-label="Sort"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <BadgeLegend />

      {result.status === 'loading' ? <SkeletonRows /> : null}
      {result.status === 'error' ? (
        <p className="panel-error">Failed to load items: {result.error}</p>
      ) : null}
      {result.status === 'ok' ? (
        <>
          <p className="panel-muted">
            {result.data.total} item{result.data.total === 1 ? '' : 's'}
          </p>
          {result.data.items.length === 0 ? (
            <p className="panel-muted">No items match these filters.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Form</th>
                    <th>Slug</th>
                    <th>Meaning</th>
                    <th>Level</th>
                    <th>Status</th>
                    <th>Completeness</th>
                    <th>Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((item) => {
                    // The first unfilled field decides where "how do I fix this
                    // percentage" points — they are listed in generation order.
                    const firstMissing = item.completeness.missing[0];
                    const stageId = firstMissing
                      ? stageIdForField(item.type, firstMissing)
                      : undefined;
                    return (
                    <tr key={`${item.type}:${item.slug}`}>
                      <td>
                        <Link
                          to={`/content/${item.type}/${item.slug}${detailSearch}`}
                          className="row-link content-form"
                        >
                          {item.primaryForm}
                        </Link>
                      </td>
                      <td>
                        <Link
                          to={`/content/${item.type}/${item.slug}${detailSearch}`}
                          className="row-link"
                        >
                          {item.slug}
                        </Link>
                      </td>
                      <td>{item.meaning}</td>
                      <td>{item.level}</td>
                      <td>
                        <div className="status-cell">
                          <StatusBadge status={item.reviewStatus} />
                          <ReviewStatusControl
                            type={item.type}
                            slug={item.slug}
                            status={item.reviewStatus}
                            onChanged={() => setRefreshToken((v) => v + 1)}
                          />
                        </div>
                      </td>
                      <td>
                        <CompletenessPill
                          percent={item.completeness.percent}
                          skeleton={item.completeness.percent < 0.6}
                          href={stageId ? guideHref(`stage-${stageId}`, item.level) : undefined}
                          title={
                            item.completeness.missing.length > 0
                              ? `Missing: ${item.completeness.missing.join(', ')} — how to generate them`
                              : undefined
                          }
                        />
                      </td>
                      <td>
                        {item.auditSeverity ? (
                          <Link
                            to={`/content/${item.type}/${item.slug}${detailSearch}#audit-findings`}
                            className="audit-badge-link"
                            title={`${item.auditFindingCount} audit finding(s) — open them`}
                          >
                            <SeverityBadge
                              severity={item.auditSeverity as FindingSeverity}
                              count={item.auditFindingCount}
                            />
                          </Link>
                        ) : (
                          <span className="panel-muted">—</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="pagination">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => updateParams({ page: String(page - 1) })}
            >
              Previous
            </button>
            <span className="pagination__status">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => updateParams({ page: String(page + 1) })}
            >
              Next
            </button>
            <label className="pagination__page-size">
              Show
              <select
                value={effectivePageSize}
                onChange={(e) =>
                  updateParams({
                    pageSize:
                      Number(e.target.value) === DEFAULT_PAGE_SIZE
                        ? null
                        : e.target.value,
                    page: null,
                  })
                }
                aria-label="Items per page"
              >
                {pageSizeOptions.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              per page
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
}

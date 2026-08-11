import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CompletenessPill } from '../components/CompletenessPill';
import { StatusBadge } from '../components/StatusBadge';
import { useApi } from '../hooks/useApi';
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  MISSING_FIELD_OPTIONS,
  STATUS_LABELS,
  type ContentType,
  type ItemsResponse,
  type JlptLevel,
  type ReviewStatus,
} from '../types/api';

const LEVEL_OPTIONS: Array<JlptLevel | ''> = ['', 'N5', 'N4'];
const STATUSES: ReviewStatus[] = ['draft', 'reviewed', 'flagged_for_rewrite', 'none'];
const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

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
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, i) => (
            <tr key={i}>
              <td colSpan={6}>
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
  const sort = searchParams.get('sort') ?? 'sort_order';
  const page = Math.max(1, Number(searchParams.get('page')) || 1);

  const [searchInput, setSearchInput] = useState(q);

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
    qs.set('sort', sort);
    qs.set('page', String(page));
    qs.set('pageSize', String(PAGE_SIZE));
    return `/api/items?${qs.toString()}`;
  }, [type, level, status, skeleton, missing, q, sort, page]);

  const result = useApi<ItemsResponse>(apiUrl);
  const missingOptions = MISSING_FIELD_OPTIONS[type];
  const totalPages =
    result.status === 'ok' ? Math.max(1, Math.ceil(result.data.total / PAGE_SIZE)) : 1;

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
          Skeleton only
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

        <label
          className="checkbox-field checkbox-field--disabled"
          title="Coming in Chunk 7"
        >
          <input type="checkbox" disabled />
          Has audit issues
        </label>

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
                  </tr>
                </thead>
                <tbody>
                  {result.data.items.map((item) => (
                    <tr key={`${item.type}:${item.slug}`}>
                      <td>
                        <Link
                          to={`/content/${item.type}/${item.slug}`}
                          className="row-link content-form"
                        >
                          {item.primaryForm}
                        </Link>
                      </td>
                      <td>
                        <Link
                          to={`/content/${item.type}/${item.slug}`}
                          className="row-link"
                        >
                          {item.slug}
                        </Link>
                      </td>
                      <td>{item.meaning}</td>
                      <td>{item.level}</td>
                      <td>
                        <StatusBadge status={item.reviewStatus} />
                      </td>
                      <td
                        title={
                          item.completeness.missing.length > 0
                            ? `Missing: ${item.completeness.missing.join(', ')}`
                            : undefined
                        }
                      >
                        <CompletenessPill
                          percent={item.completeness.percent}
                          skeleton={item.completeness.percent < 0.6}
                        />
                      </td>
                    </tr>
                  ))}
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
          </div>
        </>
      ) : null}
    </div>
  );
}

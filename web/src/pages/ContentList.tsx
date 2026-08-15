import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BadgeLegend } from '../components/BadgeLegend';
import { CompletenessPill } from '../components/CompletenessPill';
import { EDITABLE_STATUSES } from '../components/ReviewStatusControl';
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
  type ContentListItem,
  type ContentType,
  type FindingSeverity,
  type ItemsModelsResponse,
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
const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
/** Start loading the next chunk this far before the list end scrolls into view. */
const LOAD_MORE_MARGIN = '600px 0px';

// Per list URL (path + query): how many chunks were loaded and where the user
// was scrolled, so navigating to a detail page and back restores both. Keyed
// off the full search string, so it only applies to the same filters/sort.
const listMemory = new Map<string, { pages: number; scrollY: number }>();

const SORT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'sort_order', label: 'Sort order' },
  { value: 'completeness_asc', label: 'Completeness (low first)' },
  { value: 'slug', label: 'Slug' },
];

function isContentType(value: string | undefined): value is ContentType {
  return !!value && (CONTENT_TYPES as string[]).includes(value);
}

async function fetchItems(url: string): Promise<ItemsResponse> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `${res.status} ${res.statusText}`);
  }
  return (await res.json()) as ItemsResponse;
}

function SkeletonRows() {
  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="row-number-column" />
            <th className="checkbox-column" />
            <th>Form</th>
            <th>Slug</th>
            <th>Meaning</th>
            <th>Level</th>
            <th>Status</th>
            <th>Model</th>
            <th>Completeness</th>
            <th>Audit</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }, (_, i) => (
            <tr key={i}>
              <td colSpan={10}>
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const scrollKey = location.pathname + location.search;

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
  const model = searchParams.get('model') ?? '';
  const sort = searchParams.get('sort') ?? 'sort_order';

  const [searchInput, setSearchInput] = useState(q);
  const [refreshToken, setRefreshToken] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllLoading, setSelectAllLoading] = useState(false);
  const [bulkSaving, setBulkSaving] = useState<ReviewStatus | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [items, setItems] = useState<ContentListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadedPages, setLoadedPages] = useState(1);
  const [listStatus, setListStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [listError, setListError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [restorePending, setRestorePending] = useState(false);

  useEffect(() => {
    setSearchInput(q);
  }, [q]);

  // Selection is scoped to the current type tab; a tab switch shows a
  // different table, so any prior selection no longer refers to visible rows.
  useEffect(() => {
    setSelected(new Set());
  }, [type]);

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
        updateParams({ q: searchInput || null });
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput]);

  const filterQs = useMemo(() => {
    const qs = new URLSearchParams();
    qs.set('type', type);
    if (level) qs.set('level', level);
    if (status) qs.set('status', status);
    if (skeleton) qs.set('skeleton', 'true');
    if (missing) qs.set('missing', missing);
    if (q) qs.set('q', q);
    if (audit) qs.set('audit', audit);
    if (model) qs.set('model', model);
    qs.set('sort', sort);
    return qs.toString();
  }, [type, level, status, skeleton, missing, q, audit, model, sort]);

  // Identifies the current result set: any change restarts from the first
  // chunk, and in-flight appends for an older key are discarded.
  const requestKey = `${filterQs}|${refreshToken}`;
  const requestKeyRef = useRef(requestKey);
  // Suppressed while a fresh result set loads, so the momentary zero-height
  // list can't overwrite a saved scroll position with 0.
  const canSaveScrollRef = useRef(false);

  const modelsResult = useApi<ItemsModelsResponse>('/api/items/models');
  const modelOptions = modelsResult.status === 'ok' ? modelsResult.data.models : [];

  useEffect(() => {
    requestKeyRef.current = requestKey;
    canSaveScrollRef.current = false;
    // Returning to a list we scrolled through re-requests every chunk that
    // was loaded, in one call, so the saved scroll position lands on rows.
    const initialPages = Math.max(1, listMemory.get(scrollKey)?.pages ?? 1);
    let cancelled = false;
    setListStatus('loading');
    setListError(null);
    setItems([]);
    fetchItems(`/api/items?${filterQs}&page=1&pageSize=${initialPages * PAGE_SIZE}`)
      .then((body) => {
        if (cancelled) return;
        setItems(body.items);
        setTotal(body.total);
        setLoadedPages(initialPages);
        setListStatus('ok');
        setRestorePending(true);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setListError(err instanceof Error ? err.message : 'Request failed');
        setListStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [requestKey, filterQs, scrollKey]);

  // Restore once the real rows are rendered (not the skeleton), then stop
  // suppressing saves so further scrolling is tracked again.
  useEffect(() => {
    if (!restorePending) return;
    const saved = listMemory.get(scrollKey)?.scrollY ?? 0;
    if (saved > 0) window.scrollTo(0, saved);
    setRestorePending(false);
    canSaveScrollRef.current = true;
  }, [restorePending, scrollKey]);

  useEffect(() => {
    function handleScroll() {
      if (!canSaveScrollRef.current) return;
      const prev = listMemory.get(scrollKey);
      listMemory.set(scrollKey, { pages: prev?.pages ?? 1, scrollY: window.scrollY });
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [scrollKey]);

  const hasMore = listStatus === 'ok' && items.length < total;

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const key = requestKey;
    const nextPage = loadedPages + 1;
    setLoadingMore(true);
    setListError(null);
    fetchItems(`/api/items?${filterQs}&page=${nextPage}&pageSize=${PAGE_SIZE}`)
      .then((body) => {
        if (requestKeyRef.current !== key) return;
        setItems((prev) => [...prev, ...body.items]);
        setTotal(body.total);
        setLoadedPages(nextPage);
        const prev = listMemory.get(scrollKey);
        listMemory.set(scrollKey, { pages: nextPage, scrollY: prev?.scrollY ?? 0 });
      })
      .catch((err: unknown) => {
        if (requestKeyRef.current !== key) return;
        setListError(err instanceof Error ? err.message : 'Request failed');
      })
      .finally(() => {
        if (requestKeyRef.current !== key) return;
        setLoadingMore(false);
      });
  }, [loadingMore, hasMore, requestKey, loadedPages, filterQs, scrollKey]);

  // Loading the next chunk changes `loadMore`, which re-arms the observer; if
  // the end marker is still in view it fires again until the list is complete.
  const endMarkerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = endMarkerRef.current;
    if (!el || !hasMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: LOAD_MORE_MARGIN },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const missingOptions = MISSING_FIELD_OPTIONS[type];
  const detailSearch = listContextSearch(searchParams);

  const loadedSlugs = items.map((item) => item.slug);
  const allLoadedSelected = loadedSlugs.length > 0 && loadedSlugs.every((s) => selected.has(s));

  function toggleSelectLoaded() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allLoadedSelected) {
        for (const slug of loadedSlugs) next.delete(slug);
      } else {
        for (const slug of loadedSlugs) next.add(slug);
      }
      return next;
    });
  }

  function toggleSelectOne(slug: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
      return next;
    });
  }

  async function selectAllFiltered() {
    setSelectAllLoading(true);
    try {
      const body = await fetchItems(`/api/items?${filterQs}&page=1&pageSize=${total}`);
      setSelected(new Set(body.items.map((item) => item.slug)));
    } finally {
      setSelectAllLoading(false);
    }
  }

  async function applyBulkStatus(nextStatus: Exclude<ReviewStatus, 'none'>) {
    if (selected.size === 0) return;
    setBulkSaving(nextStatus);
    setBulkError(null);
    try {
      const res = await fetch('/api/items/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: Array.from(selected).map((slug) => ({ type, slug })),
          review_status: nextStatus,
        }),
      });
      const body = await res.json();
      if (!res.ok || body.ok === false) {
        setBulkError(body.errors?.join('; ') ?? 'Bulk update failed');
        return;
      }
      setSelected(new Set());
      setRefreshToken((v) => v + 1);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Bulk update failed');
    } finally {
      setBulkSaving(null);
    }
  }

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
              onClick={() => updateParams({ level: lvl || null })}
            >
              {lvl || 'All'}
            </button>
          ))}
        </div>

        <select
          value={status}
          onChange={(e) => updateParams({ status: e.target.value || null })}
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
            onChange={(e) => updateParams({ skeleton: e.target.checked ? 'true' : null })}
          />
          Skeleton only (&lt;60%)
        </label>

        <select
          value={missing}
          onChange={(e) => updateParams({ missing: e.target.value || null })}
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
          onChange={(e) => updateParams({ audit: e.target.value || null })}
          aria-label="Audit status"
        >
          {AUDIT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <select
          value={model}
          onChange={(e) => updateParams({ model: e.target.value || null })}
          aria-label="Generator model"
        >
          <option value="">Any model</option>
          {modelOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(e) => updateParams({ sort: e.target.value })}
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

      {selected.size > 0 ? (
        <div className="bulk-bar">
          <span className="bulk-bar__count">{selected.size} selected</span>
          <div className="bulk-bar__actions">
            {EDITABLE_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                disabled={bulkSaving !== null}
                onClick={() => applyBulkStatus(s)}
              >
                {bulkSaving === s ? 'Saving…' : `Mark ${STATUS_LABELS[s]}`}
              </button>
            ))}
          </div>
          {bulkError ? <span className="panel-error">{bulkError}</span> : null}
          <button
            type="button"
            className="bulk-bar__clear"
            disabled={bulkSaving !== null}
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </button>
        </div>
      ) : null}

      {allLoadedSelected && selected.size < total ? (
        <div className="select-all-banner">
          All {loadedSlugs.length} loaded items are selected.
          <button type="button" onClick={selectAllFiltered} disabled={selectAllLoading}>
            {selectAllLoading ? 'Selecting…' : `Select all ${total} matching items`}
          </button>
        </div>
      ) : null}

      {listStatus === 'loading' ? <SkeletonRows /> : null}
      {listStatus === 'error' ? (
        <p className="panel-error">Failed to load items: {listError}</p>
      ) : null}
      {listStatus === 'ok' ? (
        <>
          <p className="panel-muted">
            {items.length < total
              ? `Showing ${items.length} of ${total} items`
              : `${total} item${total === 1 ? '' : 's'}`}
          </p>
          {items.length === 0 ? (
            <p className="panel-muted">No items match these filters.</p>
          ) : (
            <>
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="row-number-column" />
                      <th className="checkbox-column">
                        <input
                          type="checkbox"
                          aria-label="Select all loaded"
                          checked={allLoadedSelected}
                          onChange={toggleSelectLoaded}
                        />
                      </th>
                      <th>Form</th>
                      <th>Slug</th>
                      <th>Meaning</th>
                      <th>Level</th>
                      <th>Status</th>
                      <th>Model</th>
                      <th>Completeness</th>
                      <th>Audit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      // The first unfilled field decides where "how do I fix this
                      // percentage" points — they are listed in generation order.
                      const firstMissing = item.completeness.missing[0];
                      const stageId = firstMissing
                        ? stageIdForField(item.type, firstMissing)
                        : undefined;
                      return (
                      <tr key={`${item.type}:${item.slug}`}>
                        <td className="row-number-column panel-muted">{index + 1}</td>
                        <td className="checkbox-column">
                          <input
                            type="checkbox"
                            aria-label={`Select ${item.slug}`}
                            checked={selected.has(item.slug)}
                            onChange={() => toggleSelectOne(item.slug)}
                          />
                        </td>
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
                          <StatusBadge status={item.reviewStatus} />
                        </td>
                        <td>{item.meta?.generator_model ?? <span className="panel-muted">—</span>}</td>
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

              <div className="list-end" ref={endMarkerRef} aria-live="polite">
                {listError ? (
                  <span className="panel-error">Failed to load more: {listError}</span>
                ) : null}
                {loadingMore ? (
                  <span className="panel-muted">Loading more…</span>
                ) : hasMore ? (
                  <button type="button" onClick={loadMore}>
                    Load {Math.min(PAGE_SIZE, total - items.length)} more
                  </button>
                ) : (
                  <span className="panel-muted">End of list</span>
                )}
              </div>
            </>
          )}
        </>
      ) : null}
    </div>
  );
}

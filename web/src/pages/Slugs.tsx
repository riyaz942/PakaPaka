import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CompletenessPill } from '../components/CompletenessPill';
import { EDITABLE_STATUSES } from '../components/ReviewStatusControl';
import { SeverityBadge } from '../components/SeverityBadge';
import { StatusBadge } from '../components/StatusBadge';
import { guideHref, stageIdForField } from '../lib/guide';
import {
  CONTENT_TYPE_LABELS,
  STATUS_LABELS,
  type ContentListItem,
  type ReviewStatus,
  type SlugResolveResponse,
  type SlugResolveRow,
} from '../types/api';

/** A studio URL pasted back in, e.g. http://localhost:4701/content/kanji/mizu. */
const CONTENT_PATH_RE =
  /(?:^|\/)content\/(radical|kanji|vocabulary|grammar|reading)\/([^/?#]+)/i;

/**
 * Everything a paste can hold: bare slugs, `kanji:mizu`, studio URLs, markdown
 * bullets, backticks, comma- or newline-separated lists. Every slug in the
 * curriculum matches `[a-z0-9]+(-[a-z0-9]+)*`, so stripping non-alphanumeric
 * edges off each whitespace/comma-delimited token is enough. Anything left over
 * is kept, not dropped — it comes back as "unresolved" so the paste is visibly
 * accounted for. The one exception is bare list numbering ("1.", "2."), which
 * would otherwise report as unresolved once per line.
 */
export function parseSlugInput(text: string): string[] {
  const out: string[] = [];
  for (const token of text.split(/[\s,;|]+/)) {
    const url = CONTENT_PATH_RE.exec(token);
    if (url) {
      out.push(`${url[1].toLowerCase()}:${url[2]}`);
      continue;
    }
    const cleaned = token.replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9]+$/, '');
    if (cleaned.length === 0 || /^\d+$/.test(cleaned)) continue;
    out.push(cleaned.toLowerCase());
  }
  return out;
}

type RenderRow = {
  input: string;
  item: ContentListItem;
  /** The token matched more than one item, so it cannot be marked in bulk. */
  ambiguous: boolean;
};

function selectionKey(item: ContentListItem): string {
  return `${item.type}:${item.slug}`;
}

function flatten(rows: SlugResolveRow[]): RenderRow[] {
  const out: RenderRow[] = [];
  for (const row of rows) {
    for (const item of row.matches) {
      out.push({ input: row.input, item, ambiguous: row.matches.length > 1 });
    }
  }
  return out;
}

export default function Slugs() {
  const [text, setText] = useState('');
  const [rows, setRows] = useState<SlugResolveRow[] | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState<ReviewStatus | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkDone, setBulkDone] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const parsed = useMemo(() => parseSlugInput(text), [text]);
  const renderRows = useMemo(() => (rows ? flatten(rows) : []), [rows]);
  const unresolved = useMemo(
    () => (rows ?? []).filter((row) => row.matches.length === 0).map((row) => row.input),
    [rows],
  );
  const ambiguousCount = useMemo(
    () => (rows ?? []).filter((row) => row.matches.length > 1).length,
    [rows],
  );

  async function handleResolve() {
    setResolving(true);
    setResolveError(null);
    setBulkError(null);
    setBulkDone(null);
    setSelected(new Set());
    try {
      const res = await fetch('/api/items/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slugs: parsed }),
      });
      const body = await res.json();
      if (!res.ok) {
        setResolveError(body.error ?? 'Resolve failed');
        return;
      }
      setRows((body as SlugResolveResponse).rows);
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Resolve failed');
    } finally {
      setResolving(false);
    }
  }

  // "Select all" skips ambiguous rows on purpose: marking a status writes the
  // source JSON, and a bare slug that means both a radical and a vocabulary word
  // has to be picked by hand.
  const selectableKeys = renderRows
    .filter((row) => !row.ambiguous)
    .map((row) => selectionKey(row.item));
  const allSelected =
    selectableKeys.length > 0 && selectableKeys.every((key) => selected.has(key));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const key of selectableKeys) {
        if (allSelected) next.delete(key);
        else next.add(key);
      }
      return next;
    });
  }

  function toggleSelectOne(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function applyBulkStatus(nextStatus: Exclude<ReviewStatus, 'none'>) {
    if (selected.size === 0) return;
    setBulkSaving(nextStatus);
    setBulkError(null);
    setBulkDone(null);
    const targets = renderRows
      .filter((row) => selected.has(selectionKey(row.item)))
      .map((row) => ({ type: row.item.type, slug: row.item.slug }));
    try {
      const res = await fetch('/api/items/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: targets, review_status: nextStatus }),
      });
      const body = await res.json();
      if (!res.ok || body.ok === false) {
        setBulkError(body.errors?.join('; ') ?? 'Bulk update failed');
        return;
      }
      // Re-resolve so the Status column reflects what was just written. It
      // clears the banner, so the confirmation is set after it settles.
      await handleResolve();
      setBulkDone(`Marked ${body.updated} item(s) ${STATUS_LABELS[nextStatus]}.`);
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : 'Bulk update failed');
    } finally {
      setBulkSaving(null);
    }
  }

  async function handleCopyLinks() {
    const links = renderRows.map(
      (row) => `${window.location.origin}/content/${row.item.type}/${row.item.slug}`,
    );
    await navigator.clipboard.writeText(links.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="slugs-page">
      <section className="panel">
        <h2 className="dashboard-title">Slug lookup</h2>
        <p className="dashboard-sub">
          Paste the slugs from a generation session — bare (<code>mizu</code>), typed
          (<code>kanji:mizu</code>), or studio URLs — separated by newlines, spaces or commas.
          Bullets, numbering and backticks are stripped.
        </p>
        <textarea
          className="edit-textarea slugs-input"
          rows={8}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'mizu\nkanji:hi-sun\n- taberu\nhttp://localhost:4701/content/grammar/hoshii'}
          aria-label="Slugs to resolve"
        />
        <div className="slugs-actions">
          <button
            type="button"
            className="audit-run-button"
            onClick={handleResolve}
            disabled={resolving || parsed.length === 0}
          >
            {resolving ? 'Resolving…' : `Resolve ${parsed.length} slug${parsed.length === 1 ? '' : 's'}`}
          </button>
          {text.length > 0 ? (
            <button
              type="button"
              className="bulk-bar__clear"
              onClick={() => {
                setText('');
                setRows(null);
                setSelected(new Set());
                setBulkDone(null);
                setBulkError(null);
              }}
            >
              Clear
            </button>
          ) : null}
        </div>
        {resolveError ? <p className="panel-error">{resolveError}</p> : null}
      </section>

      {rows !== null ? (
        <section className="panel">
          <div className="slugs-summary">
            <p className="panel-muted">
              {renderRows.length} match{renderRows.length === 1 ? '' : 'es'} from {rows.length}{' '}
              token{rows.length === 1 ? '' : 's'}
              {unresolved.length > 0 ? ` · ${unresolved.length} unresolved` : ''}
              {ambiguousCount > 0 ? ` · ${ambiguousCount} ambiguous` : ''}
            </p>
            {renderRows.length > 0 ? (
              <button
                type="button"
                className={copied ? 'copy-button copy-button--done' : 'copy-button'}
                onClick={handleCopyLinks}
              >
                {copied ? 'Copied ✓' : 'Copy links'}
              </button>
            ) : null}
          </div>

          {bulkDone ? <p className="slugs-done">{bulkDone}</p> : null}

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

          {renderRows.length > 0 ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="row-number-column" />
                    <th className="checkbox-column">
                      <input
                        type="checkbox"
                        aria-label="Select all unambiguous matches"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                      />
                    </th>
                    <th>Type</th>
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
                  {renderRows.map((row, index) => {
                    const key = selectionKey(row.item);
                    const firstMissing = row.item.completeness.missing[0];
                    const stageId = firstMissing
                      ? stageIdForField(row.item.type, firstMissing)
                      : undefined;
                    const href = `/content/${row.item.type}/${row.item.slug}`;
                    return (
                      <tr key={`${row.input}|${key}`}>
                        <td className="row-number-column panel-muted">{index + 1}</td>
                        <td className="checkbox-column">
                          <input
                            type="checkbox"
                            aria-label={`Select ${key}`}
                            checked={selected.has(key)}
                            onChange={() => toggleSelectOne(key)}
                          />
                        </td>
                        <td>
                          {CONTENT_TYPE_LABELS[row.item.type]}
                          {row.ambiguous ? (
                            <span
                              className="slugs-ambiguous"
                              title={`"${row.input}" also exists under another content type — pick the right one by hand`}
                            >
                              ambiguous
                            </span>
                          ) : null}
                        </td>
                        <td>
                          <Link to={href} target="_blank" className="row-link content-form">
                            {row.item.primaryForm}
                          </Link>
                        </td>
                        <td>
                          <Link to={href} target="_blank" className="row-link">
                            {row.item.slug}
                          </Link>
                        </td>
                        <td>{row.item.meaning}</td>
                        <td>{row.item.level}</td>
                        <td>
                          <StatusBadge status={row.item.reviewStatus} />
                        </td>
                        <td>
                          <CompletenessPill
                            percent={row.item.completeness.percent}
                            skeleton={row.item.completeness.percent <= 0.6}
                            href={stageId ? guideHref(`stage-${stageId}`, row.item.level) : undefined}
                            title={
                              row.item.completeness.missing.length > 0
                                ? `Missing: ${row.item.completeness.missing.join(', ')} — how to generate them`
                                : undefined
                            }
                          />
                        </td>
                        <td>
                          {row.item.auditSeverity ? (
                            <Link
                              to={`${href}#audit-findings`}
                              target="_blank"
                              className="audit-badge-link"
                              title={`${row.item.auditFindingCount} audit finding(s) — open them`}
                            >
                              <SeverityBadge
                                severity={row.item.auditSeverity}
                                count={row.item.auditFindingCount}
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
          ) : (
            <p className="panel-muted">Nothing in this paste matched a curriculum item.</p>
          )}

          {unresolved.length > 0 ? (
            <>
              <h3 className="panel-title">Unresolved ({unresolved.length})</h3>
              <p className="panel-muted">
                No item carries these slugs. Either they are not generated yet, or the token was
                never a slug (a heading or stray word in the paste).
              </p>
              <div className="audit-finding-row__slugs">
                {unresolved.map((slug) => (
                  <span key={slug} className="related-chip related-chip--static">
                    {slug}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

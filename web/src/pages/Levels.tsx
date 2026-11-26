import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { useApi } from '../hooks/useApi';
import {
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  type ContentType,
  type LevelItem,
  type LevelResponse,
} from '../types/api';
import { TypeSection } from './ItemDetail';

const DAY_OPTIONS = [1, 3, 7, 14, 30];

function itemKey(item: LevelItem): string {
  return `${item.type}:${item.slug}`;
}

function LevelItemCard({
  item,
  open,
  onToggle,
  showReadings,
  onChanged,
}: {
  item: LevelItem;
  open: boolean;
  onToggle: () => void;
  showReadings: boolean;
  onChanged: () => void;
}) {
  return (
    <article className={item.changed ? 'level-item level-item--changed' : 'level-item'}>
      <header className="level-item__head">
        <button type="button" className="level-item__toggle" onClick={onToggle} aria-expanded={open}>
          <span className="level-item__arrow">{open ? '▾' : '▸'}</span>
          <span className="level-item__form">{item.primaryForm}</span>
          <span className="level-item__meaning">{item.meaning}</span>
          <span className="level-item__slug">{item.slug}</span>
        </button>
        <span className="level-item__badges">
          {item.changed ? <span className="changed-badge">changed</span> : null}
          <StatusBadge status={item.reviewStatus} />
          {item.meta?.generator_model ? (
            <span className="level-item__model">{item.meta.generator_model}</span>
          ) : null}
          <Link to={`/content/${item.type}/${item.slug}`} className="level-item__open">
            Open →
          </Link>
        </span>
      </header>
      {open ? (
        <div className="level-item__body">
          <TypeSection item={item} showReadings={showReadings} onChanged={onChanged} />
        </div>
      ) : null}
    </article>
  );
}

/** Everything taught at one ladder level, read top to bottom. Read-only except grammar mnemonic status. */
export default function Levels() {
  const params = useParams<{ level: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const level = Number(params.level) || 1;
  const days = searchParams.get('days') ?? '3';
  const onlyChanged = searchParams.get('changed') === '1';

  const [hiddenTypes, setHiddenTypes] = useState<Set<ContentType>>(new Set());
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());
  const [showReadings, setShowReadings] = useState(true);
  const [refresh, setRefresh] = useState(0);

  const state = useApi<LevelResponse>(`/api/level/${level}?days=${days}&refresh=${refresh}`);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value === null) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  }

  function goToLevel(next: number) {
    setOpenKeys(new Set());
    navigate(`/levels/${next}?${searchParams.toString()}`);
  }

  function toggleType(type: ContentType) {
    setHiddenTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function toggleOpen(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const data = state.status === 'ok' ? state.data : null;
  const levels = data?.levels ?? [];
  const position = levels.indexOf(level);
  const visible = (data?.items ?? []).filter(
    (item) => !hiddenTypes.has(item.type) && (!onlyChanged || item.changed),
  );
  const changedCount = (data?.items ?? []).filter((item) => item.changed).length;

  return (
    <div className="content-list">
      <section className="panel">
        <h2 className="dashboard-title">Level {level}</h2>
        <p className="dashboard-sub">
          Everything taught at this level, in teaching order. Click a row to read its content; use
          Open to edit it.
        </p>
        <div className="filter-bar">
          <button
            type="button"
            className="chip"
            disabled={position <= 0}
            onClick={() => goToLevel(levels[position - 1])}
          >
            ← Previous
          </button>
          <select value={level} onChange={(e) => goToLevel(Number(e.target.value))} aria-label="Level">
            {(levels.length > 0 ? levels : [level]).map((lv) => (
              <option key={lv} value={lv}>
                Level {lv}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="chip"
            disabled={position < 0 || position >= levels.length - 1}
            onClick={() => goToLevel(levels[position + 1])}
          >
            Next →
          </button>

          <label className="checkbox-field">
            Changed in the last
            <select value={days} onChange={(e) => setParam('days', e.target.value)} aria-label="Days">
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={String(d)}>
                  {d} day{d === 1 ? '' : 's'}
                </option>
              ))}
            </select>
          </label>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={onlyChanged}
              onChange={(e) => setParam('changed', e.target.checked ? '1' : null)}
            />
            Only changed
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

        {data ? (
          <p className="panel-muted">
            {data.base ? (
              <>
                {changedCount} item{changedCount === 1 ? '' : 's'} changed since{' '}
                <code>{data.base.rev.slice(0, 8)}</code> ({data.base.date.slice(0, 10)}, “
                {data.base.subject}”), uncommitted edits included.
              </>
            ) : (
              <>No commit is older than {days} days, so no item is marked changed.</>
            )}
          </p>
        ) : null}
      </section>

      {state.status === 'loading' ? <p className="panel-muted">Loading level {level}…</p> : null}
      {state.status === 'error' ? (
        <p className="panel-error">Failed to load level {level}: {state.error}</p>
      ) : null}

      {data ? (
        <>
          <div className="filter-bar">
            <div className="chip-group" role="group" aria-label="Content types">
              {CONTENT_TYPES.map((type) => {
                const items = data.items.filter((i) => i.type === type);
                return (
                  <button
                    key={type}
                    type="button"
                    className={hiddenTypes.has(type) ? 'chip' : 'chip chip--active'}
                    onClick={() => toggleType(type)}
                  >
                    {CONTENT_TYPE_LABELS[type]} {items.length}
                  </button>
                );
              })}
            </div>
            <button type="button" className="chip" onClick={() => setOpenKeys(new Set(visible.map(itemKey)))}>
              Expand all
            </button>
            <button type="button" className="chip" onClick={() => setOpenKeys(new Set())}>
              Collapse all
            </button>
          </div>

          {visible.length === 0 ? (
            <p className="panel-muted">No items match these filters.</p>
          ) : null}

          {CONTENT_TYPES.filter((type) => visible.some((i) => i.type === type)).map((type) => (
            <section key={type} className="level-section">
              <h3 className="panel-title">{CONTENT_TYPE_LABELS[type]}</h3>
              {visible
                .filter((item) => item.type === type)
                .map((item) => (
                  <LevelItemCard
                    key={itemKey(item)}
                    item={item}
                    open={openKeys.has(itemKey(item))}
                    onToggle={() => toggleOpen(itemKey(item))}
                    showReadings={showReadings}
                    onChanged={() => setRefresh((r) => r + 1)}
                  />
                ))}
            </section>
          ))}
        </>
      ) : null}
    </div>
  );
}

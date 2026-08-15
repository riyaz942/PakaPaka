import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AuditFindingsPanel } from '../components/AuditFindingsPanel';
import { CompletenessPill } from '../components/CompletenessPill';
import { DependencyPanel } from '../components/DependencyPanel';
import { EditForm } from '../components/edit/EditForm';
import { ItemNeighborhoodGraph } from '../components/ItemNeighborhoodGraph';
import { ReviewStatusControl } from '../components/ReviewStatusControl';
import { StatusBadge } from '../components/StatusBadge';
import { useApi } from '../hooks/useApi';
import { guideHref, stageIdForField } from '../lib/guide';
import { LIST_FILTER_KEYS, listContextSearch, pickSearchParams } from '../lib/listContext';
import {
  CONTENT_TYPES,
  type ContentType,
  type ItemDetailResponse,
  type ItemsNeighborsResponse,
} from '../types/api';
import type { GrammarRaw, KanjiRaw, RadicalRaw, ReadingRaw, VocabRaw } from '../types/curriculumRaw';
import { GrammarDetail } from './detail/GrammarDetail';
import { KanjiDetail } from './detail/KanjiDetail';
import { RadicalDetail } from './detail/RadicalDetail';
import { ReadingDetail } from './detail/ReadingDetail';
import { VocabularyDetail } from './detail/VocabularyDetail';

function isContentType(value: string | undefined): value is ContentType {
  return !!value && (CONTENT_TYPES as string[]).includes(value);
}

function TypeSection({ item, showReadings }: { item: ItemDetailResponse; showReadings: boolean }) {
  switch (item.type) {
    case 'radical':
      return <RadicalDetail raw={item.raw as unknown as RadicalRaw} />;
    case 'kanji':
      return <KanjiDetail raw={item.raw as unknown as KanjiRaw} showReadings={showReadings} />;
    case 'vocabulary':
      return <VocabularyDetail raw={item.raw as unknown as VocabRaw} showReadings={showReadings} />;
    case 'grammar':
      return <GrammarDetail raw={item.raw as unknown as GrammarRaw} showReadings={showReadings} />;
    case 'reading':
      return <ReadingDetail raw={item.raw as unknown as ReadingRaw} showReadings={showReadings} />;
  }
}

function ItemListNav({ type, slug }: { type: ContentType; slug: string }) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const neighborsUrl = useMemo(() => {
    const qs = pickSearchParams(searchParams, LIST_FILTER_KEYS);
    qs.set('type', type);
    qs.set('slug', slug);
    return `/api/items/neighbors?${qs.toString()}`;
  }, [searchParams, type, slug]);

  // Round-trips the list filters so links between detail pages keep the same
  // list context (and the list restores its loaded rows on back-nav).
  const detailSearch = useMemo(() => listContextSearch(searchParams), [searchParams]);

  const result = useApi<ItemsNeighborsResponse>(neighborsUrl);

  // A real back-navigation (not a fresh push) so the list is restored exactly
  // as left, including loaded rows and scroll position.
  const backButton = (
    <button type="button" className="item-list-nav__back" onClick={() => navigate(-1)}>
      ← Back to list
    </button>
  );

  if (result.status === 'loading') {
    return (
      <nav className="item-list-nav" aria-label="List navigation">
        {backButton}
        <span className="panel-muted">Loading neighbors…</span>
      </nav>
    );
  }

  if (result.status === 'error') {
    return (
      <nav className="item-list-nav" aria-label="List navigation">
        {backButton}
      </nav>
    );
  }

  const { prev, next, index, total } = result.data;
  const positionLabel =
    index >= 0 && total > 0
      ? `${index + 1} of ${total}`
      : total > 0
        ? `Not in filtered list (${total})`
        : null;

  return (
    <nav className="item-list-nav" aria-label="List navigation">
      {backButton}
      <div className="item-list-nav__pager">
        {prev ? (
          <Link
            to={`/content/${prev.type}/${prev.slug}${detailSearch}`}
            replace
            className="item-list-nav__btn"
            title={prev.meaning || prev.slug}
          >
            ← Previous
            <span className="item-list-nav__hint">{prev.primaryForm}</span>
          </Link>
        ) : (
          <span className="item-list-nav__btn item-list-nav__btn--disabled" aria-disabled="true">
            ← Previous
          </span>
        )}
        {positionLabel ? (
          <span className="item-list-nav__status">{positionLabel}</span>
        ) : null}
        {next ? (
          <Link
            to={`/content/${next.type}/${next.slug}${detailSearch}`}
            replace
            className="item-list-nav__btn item-list-nav__btn--next"
            title={next.meaning || next.slug}
          >
            Next →
            <span className="item-list-nav__hint">{next.primaryForm}</span>
          </Link>
        ) : (
          <span
            className="item-list-nav__btn item-list-nav__btn--next item-list-nav__btn--disabled"
            aria-disabled="true"
          >
            Next →
          </span>
        )}
      </div>
    </nav>
  );
}

export default function ItemDetail() {
  const { type: rawType, slug } = useParams<{ type: string; slug: string }>();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get('highlight');
  const [refreshToken, setRefreshToken] = useState(0);

  const type = isContentType(rawType) ? rawType : undefined;
  const apiUrl = type && slug ? `/api/item/${type}/${slug}${refreshToken ? `?r=${refreshToken}` : ''}` : null;
  const result = useApi<ItemDetailResponse>(apiUrl);

  function refresh() {
    setRefreshToken((t) => t + 1);
  }

  if (!type || !slug) {
    return <p className="panel-error">Unknown content type.</p>;
  }

  if (result.status === 'loading') {
    return (
      <>
        <ItemListNav type={type} slug={slug} />
        <p className="panel-muted">Loading…</p>
      </>
    );
  }

  if (result.status === 'error') {
    return (
      <>
        <ItemListNav type={type} slug={slug} />
        <p className="panel-error">Failed to load item: {result.error}</p>
      </>
    );
  }

  const item = result.data;

  return <ItemDetailBody item={item} type={type} slug={slug} highlight={highlight} refresh={refresh} />;
}

function ItemDetailBody({
  item,
  type,
  slug,
  highlight,
  refresh,
}: {
  item: ItemDetailResponse;
  type: ContentType;
  slug: string;
  highlight: string | null;
  refresh: () => void;
}) {
  const [showReadings, setShowReadings] = useState(true);
  const [editing, setEditing] = useState(false);
  const { hash } = useLocation();

  useEffect(() => {
    if (!highlight && hash !== '#audit-findings') return;
    document.getElementById('audit-findings')?.scrollIntoView({ block: 'start' });
  }, [highlight, hash]);

  return (
    <div className="item-detail">
      <ItemListNav type={type} slug={slug} />

      <div className="panel item-header">
        <div className="item-header__top">
          <div>
            <div className="item-header__form">{item.primaryForm}</div>
            <div className="item-header__badges">
              <span className="item-header__slug">{item.slug}</span>
              <span className="item-header__level">{item.level}</span>
              <StatusBadge status={item.reviewStatus} />
              <ReviewStatusControl type={type} slug={slug} status={item.reviewStatus} onChanged={refresh} />
              <CompletenessPill percent={item.completeness.percent} skeleton={item.isSkeleton} />
            </div>
            {item.meaning ? <p className="item-header__meaning">{item.meaning}</p> : null}
          </div>
          <div className="item-header__actions">
            {item.meta ? (
              <div className="item-header__generator">
                {item.meta.generator_model ? <div>model: {item.meta.generator_model}</div> : null}
                {item.meta.prompt_version ? <div>prompt v{item.meta.prompt_version}</div> : null}
              </div>
            ) : null}
            <button type="button" onClick={() => setEditing((v) => !v)}>
              {editing ? 'View' : 'Edit'}
            </button>
          </div>
        </div>
        {item.completeness.missing.length > 0 ? (
          <p className="panel-muted item-header__missing">
            Missing:{' '}
            {item.completeness.missing.map((field, i) => {
              const stageId = stageIdForField(type, field);
              return (
                <span key={field}>
                  {i > 0 ? ', ' : ''}
                  {stageId ? (
                    <Link
                      to={guideHref(`stage-${stageId}`, item.level)}
                      className="missing-field-link"
                      title={`How to generate ${field}`}
                    >
                      {field}
                    </Link>
                  ) : (
                    field
                  )}
                </span>
              );
            })}
          </p>
        ) : null}
      </div>

      {editing ? (
        <EditForm
          type={type}
          slug={slug}
          initialRaw={item.raw}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            refresh();
          }}
        />
      ) : (
        <>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={showReadings}
              onChange={(e) => setShowReadings(e.target.checked)}
            />
            Show furigana readings
          </label>

          <TypeSection item={item} showReadings={showReadings} />
        </>
      )}

      <AuditFindingsPanel findings={item.auditFindings} highlight={highlight} />

      <DependencyPanel dependencySummary={item.dependencySummary} />

      <ItemNeighborhoodGraph type={type} slug={slug} />
    </div>
  );
}

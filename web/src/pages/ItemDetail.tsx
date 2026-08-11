import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AuditFindingsPanel } from '../components/AuditFindingsPanel';
import { CompletenessPill } from '../components/CompletenessPill';
import { DependencyPanel } from '../components/DependencyPanel';
import { EditForm } from '../components/edit/EditForm';
import { ItemNeighborhoodGraph } from '../components/ItemNeighborhoodGraph';
import { ReviewStatusControl } from '../components/ReviewStatusControl';
import { StatusBadge } from '../components/StatusBadge';
import { useApi } from '../hooks/useApi';
import { CONTENT_TYPES, type ContentType, type ItemDetailResponse } from '../types/api';
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
    return <p className="panel-muted">Loading…</p>;
  }

  if (result.status === 'error') {
    return <p className="panel-error">Failed to load item: {result.error}</p>;
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

  useEffect(() => {
    if (!highlight) return;
    document.getElementById('audit-findings')?.scrollIntoView({ block: 'start' });
  }, [highlight]);

  return (
    <div className="item-detail">
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
            Missing: {item.completeness.missing.join(', ')}
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

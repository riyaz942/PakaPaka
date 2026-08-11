import { Link } from 'react-router-dom';
import type { ContentType } from '../types/api';

type Props = {
  type: ContentType;
  slugs: string[] | undefined;
  emptyLabel?: string;
};

export function RelatedChips({ type, slugs, emptyLabel }: Props) {
  if (!slugs || slugs.length === 0) {
    return emptyLabel ? <p className="panel-muted">{emptyLabel}</p> : null;
  }

  return (
    <div className="chip-row">
      {slugs.map((slug) => (
        <Link key={slug} to={`/content/${type}/${slug}`} className="related-chip">
          {slug}
        </Link>
      ))}
    </div>
  );
}

import { Link } from 'react-router-dom';
import type { ContentType } from '../types/api';

type Props = {
  type: ContentType;
  slugs: string[] | undefined;
  emptyLabel?: string;
};

/** `visually_similar_slugs` holds `<kind>:<slug>` refs, because a radical and a
 * kanji may share a slug; every other list holds bare slugs of `type`. */
function linkTarget(type: ContentType, ref: string): string {
  const sep = ref.indexOf(':');
  return sep === -1 ? `/content/${type}/${ref}` : `/content/${ref.slice(0, sep)}/${ref.slice(sep + 1)}`;
}

export function RelatedChips({ type, slugs, emptyLabel }: Props) {
  if (!slugs || slugs.length === 0) {
    return emptyLabel ? <p className="panel-muted">{emptyLabel}</p> : null;
  }

  return (
    <div className="chip-row">
      {slugs.map((slug) => (
        <Link key={slug} to={linkTarget(type, slug)} className="related-chip">
          {slug}
        </Link>
      ))}
    </div>
  );
}

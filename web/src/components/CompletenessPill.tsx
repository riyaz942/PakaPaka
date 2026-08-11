import { Link } from 'react-router-dom';

type Props = {
  percent: number;
  skeleton?: boolean;
  skeletonLabel?: string;
  /** When set, the pill links here — used to point a gap at the Guide. */
  href?: string;
  title?: string;
};

function formatPercent(percent: number): string {
  return `${Math.round(percent * 100)}%`;
}

export function CompletenessPill({
  percent,
  skeleton = false,
  skeletonLabel = 'skeleton (<60% complete)',
  href,
  title,
}: Props) {
  const tone =
    percent >= 0.9 ? 'high' : percent >= 0.6 ? 'mid' : 'low';
  const className = `completeness-pill completeness-pill--${tone}${
    href ? ' completeness-pill--link' : ''
  }`;
  const body = (
    <>
      {formatPercent(percent)}
      {skeleton ? <span className="completeness-pill__warn">skel</span> : null}
    </>
  );
  const tooltip = title ?? (skeleton ? skeletonLabel : undefined);

  if (href) {
    return (
      <Link to={href} className={className} title={tooltip}>
        {body}
      </Link>
    );
  }

  return (
    <span className={className} title={tooltip}>
      {body}
    </span>
  );
}

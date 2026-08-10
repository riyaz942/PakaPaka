type Props = {
  percent: number;
  skeleton?: boolean;
  skeletonLabel?: string;
};

function formatPercent(percent: number): string {
  return `${Math.round(percent * 100)}%`;
}

export function CompletenessPill({
  percent,
  skeleton = false,
  skeletonLabel = 'skeleton (<60% complete)',
}: Props) {
  const tone =
    percent >= 0.9 ? 'high' : percent >= 0.6 ? 'mid' : 'low';

  return (
    <span
      className={`completeness-pill completeness-pill--${tone}`}
      title={skeleton ? skeletonLabel : undefined}
    >
      {formatPercent(percent)}
      {skeleton ? <span className="completeness-pill__warn">skel</span> : null}
    </span>
  );
}

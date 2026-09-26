import { CompletenessPill } from './CompletenessPill';
import { SeverityBadge } from './SeverityBadge';
import { StatusBadge } from './StatusBadge';

type Props = {
  skeletonLabel?: string;
  /** Omit sections that do not appear on the current page. */
  showAudit?: boolean;
};

export function BadgeLegend({
  skeletonLabel = 'skeleton (≤60% complete)',
  showAudit = true,
}: Props) {
  return (
    <details className="badge-legend">
      <summary>Badge legend</summary>
      <div className="badge-legend__body">
        <section className="badge-legend__section">
          <h4 className="badge-legend__heading">Completeness</h4>
          <ul className="badge-legend__list">
            <li>
              <CompletenessPill percent={0.5} skeleton skeletonLabel={skeletonLabel} />
              <span>
                Percent of required fields filled for the item&apos;s type.{' '}
                <span className="completeness-pill__warn">skel</span> marks{' '}
                {skeletonLabel}.
              </span>
            </li>
            <li>
              <span className="badge-legend__swatches">
                <CompletenessPill percent={0.4} />
                <CompletenessPill percent={0.75} />
                <CompletenessPill percent={0.95} />
              </span>
              <span>
                Color bands: under 60% (low), 60–89% (mid), 90%+ (high).
              </span>
            </li>
          </ul>
        </section>

        <section className="badge-legend__section">
          <h4 className="badge-legend__heading">Review status</h4>
          <ul className="badge-legend__list">
            <li>
              <StatusBadge status="draft" />
              <span>Generated or hand-edited; not yet accepted.</span>
            </li>
            <li>
              <StatusBadge status="reviewed" />
              <span>Accepted for shipping quality.</span>
            </li>
            <li>
              <StatusBadge status="flagged_for_rewrite" />
              <span>Needs a rewrite before it can stay.</span>
            </li>
            <li>
              <StatusBadge status="none" />
              <span>No <code>review_status</code> set on the JSON.</span>
            </li>
          </ul>
        </section>

        {showAudit ? (
          <section className="badge-legend__section">
            <h4 className="badge-legend__heading">Audit</h4>
            <ul className="badge-legend__list">
              <li>
                <SeverityBadge severity="ERROR" />
                <span>Must-fix finding from the shipped-content audit.</span>
              </li>
              <li>
                <SeverityBadge severity="WARNING" />
                <span>Likely quality issue; worth fixing.</span>
              </li>
              <li>
                <SeverityBadge severity="INFO" />
                <span>Informational note from the audit.</span>
              </li>
            </ul>
          </section>
        ) : null}
      </div>
    </details>
  );
}

import { Link } from 'react-router-dom';
import { SeverityBadge } from './SeverityBadge';
import { fixIdForCheck, guideHref } from '../lib/guide';
import type { AuditFinding } from '../types/api';

type Props = {
  findings: AuditFinding[];
  highlight?: string | null;
};

export function AuditFindingsPanel({ findings, highlight }: Props) {
  if (findings.length === 0) return null;

  return (
    <section className="panel" id="audit-findings">
      <h3 className="panel-title">Audit findings ({findings.length})</h3>
      <ul className="audit-finding-list">
        {findings.map((finding, i) => {
          const fixId = fixIdForCheck(finding.check);
          return (
            <li
              key={`${finding.check}-${i}`}
              className={
                highlight && finding.message === highlight
                  ? 'audit-finding audit-finding--highlight'
                  : 'audit-finding'
              }
            >
              <div className="audit-finding__head">
                <SeverityBadge severity={finding.severity} />
                {fixId ? (
                  <Link
                    to={guideHref(fixId)}
                    className="audit-finding__check audit-fix-link"
                    title={`How to fix: ${finding.check}`}
                  >
                    {finding.check} →
                  </Link>
                ) : (
                  <span className="audit-finding__check">{finding.check}</span>
                )}
              </div>
              <p className="audit-finding__message">{finding.message}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

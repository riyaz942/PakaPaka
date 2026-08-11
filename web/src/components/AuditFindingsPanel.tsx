import { SeverityBadge } from './SeverityBadge';
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
        {findings.map((finding, i) => (
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
              <span className="audit-finding__check">{finding.check}</span>
            </div>
            <p className="audit-finding__message">{finding.message}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

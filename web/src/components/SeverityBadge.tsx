import type { FindingSeverity } from '../types/api';

const SEVERITY_CLASS: Record<FindingSeverity, string> = {
  ERROR: 'severity-badge severity-badge--error',
  WARNING: 'severity-badge severity-badge--warning',
  INFO: 'severity-badge severity-badge--info',
};

const SEVERITY_LABELS: Record<FindingSeverity, string> = {
  ERROR: 'Error',
  WARNING: 'Warning',
  INFO: 'Info',
};

type Props = {
  severity: FindingSeverity;
  count?: number;
};

export function SeverityBadge({ severity, count }: Props) {
  return (
    <span className={SEVERITY_CLASS[severity]}>
      {SEVERITY_LABELS[severity]}
      {typeof count === 'number' ? ` (${count})` : ''}
    </span>
  );
}

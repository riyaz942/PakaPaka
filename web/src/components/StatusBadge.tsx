import type { ReviewStatus } from '../types/api';
import { STATUS_LABELS } from '../types/api';

const STATUS_CLASS: Record<ReviewStatus, string> = {
  draft: 'status-badge status-badge--draft',
  reviewed: 'status-badge status-badge--reviewed',
  flagged_for_rewrite: 'status-badge status-badge--flagged',
  none: 'status-badge status-badge--none',
};

type Props = {
  status: ReviewStatus;
};

export function StatusBadge({ status }: Props) {
  return (
    <span className={STATUS_CLASS[status]}>{STATUS_LABELS[status]}</span>
  );
}

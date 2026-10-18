import { useState } from 'react';
import type { ContentType, ReviewStatus } from '../types/api';

export const EDITABLE_STATUSES: ReviewStatus[] = ['draft', 'reviewed', 'flagged_for_rewrite', 'none'];

type Props = {
  type: ContentType;
  slug: string;
  status: ReviewStatus;
  endpoint?: 'meta' | 'mnemonic-meta';
  onChanged: () => void;
};

export function ReviewStatusControl({ type, slug, status, endpoint = 'meta', onChanged }: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(next: string) {
    if (!next) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/item/${type}/${slug}/${endpoint}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_status: next }),
      });
      const body = await res.json();
      if (!res.ok || body.ok === false) {
        setError(body.errors?.join('; ') ?? 'Update failed');
        return;
      }
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  // Reading passages have no sidecar, so a status set here would be dropped by
  // the next generate.py run (server/curriculum/sidecar.ts refuses it too).
  const unsupported = type === 'reading';

  return (
    <span className="review-status-control">
      <select
        value={status === 'none' ? '' : status}
        disabled={saving || unsupported}
        title={unsupported ? 'Reading passages are authored in curriculum/_build/{n5,n4}_readings.py' : undefined}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="" disabled>
          set status…
        </option>
        {EDITABLE_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      {error ? <span className="panel-error edit-inline-error">{error}</span> : null}
    </span>
  );
}

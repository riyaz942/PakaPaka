import { useState } from 'react';
import type { ItemFieldKind } from '../../lib/editSchema';

type Props = {
  kind: ItemFieldKind;
  value: unknown;
  onChange: (value: unknown) => void;
  /** Field is rebuilt by generate.py — show the value, refuse the edit. */
  readOnly?: boolean;
};

function JsonControl({
  value,
  onChange,
  readOnly,
}: { value: unknown; onChange: (value: unknown) => void; readOnly?: boolean }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <textarea
        className="edit-textarea edit-textarea--json"
        rows={4}
        disabled={readOnly}
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          try {
            onChange(JSON.parse(next));
            setError(null);
          } catch {
            setError('Invalid JSON — not saved until fixed');
          }
        }}
      />
      {error ? <p className="edit-json-error">{error}</p> : null}
    </div>
  );
}

export function ScalarControl({ kind, value, onChange, readOnly }: Props) {
  switch (kind) {
    case 'text':
      return (
        <input
          type="text"
          className="edit-input"
          disabled={readOnly}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'textarea':
      return (
        <textarea
          className="edit-textarea"
          rows={4}
          disabled={readOnly}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          className="edit-input edit-input--number"
          disabled={readOnly}
          value={typeof value === 'number' ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
    case 'boolean':
      return (
        <input
          type="checkbox"
          disabled={readOnly}
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
      );
    case 'stringArray': {
      const arr = Array.isArray(value) ? (value as unknown[]) : [];
      return (
        <input
          type="text"
          className="edit-input"
          placeholder="comma-separated"
          disabled={readOnly}
          value={arr.join(', ')}
          onChange={(e) =>
            onChange(
              e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter((s) => s.length > 0),
            )
          }
        />
      );
    }
    case 'json':
      return <JsonControl value={value} onChange={onChange} readOnly={readOnly} />;
    default:
      return null;
  }
}

export function SelectControl({ value, onChange, options, readOnly }: { value: unknown; onChange: (value: unknown) => void; options: string[]; readOnly?: boolean }) {
  return (
    <select className="edit-input" disabled={readOnly} value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

import { useState } from 'react';
import type { ItemFieldKind } from '../../lib/editSchema';

type Props = {
  kind: ItemFieldKind;
  value: unknown;
  onChange: (value: unknown) => void;
};

function JsonControl({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  const [text, setText] = useState(() => JSON.stringify(value ?? null, null, 2));
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <textarea
        className="edit-textarea edit-textarea--json"
        rows={4}
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

export function ScalarControl({ kind, value, onChange }: Props) {
  switch (kind) {
    case 'text':
      return (
        <input
          type="text"
          className="edit-input"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'textarea':
      return (
        <textarea
          className="edit-textarea"
          rows={4}
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
      return (
        <input
          type="number"
          className="edit-input edit-input--number"
          value={typeof value === 'number' ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      );
    case 'boolean':
      return (
        <input
          type="checkbox"
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
      return <JsonControl value={value} onChange={onChange} />;
    default:
      return null;
  }
}

export function SelectControl({ value, onChange, options }: { value: unknown; onChange: (value: unknown) => void; options: string[] }) {
  return (
    <select className="edit-input" value={typeof value === 'string' ? value : ''} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  );
}

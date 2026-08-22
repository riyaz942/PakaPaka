import { defaultForKind, type ItemFieldSpec } from '../../lib/editSchema';
import { ScalarControl } from './ScalarControl';

type Row = Record<string, unknown>;

type Props = {
  itemFields: ItemFieldSpec[];
  value: unknown;
  onChange: (rows: Row[]) => void;
  /** Whole array is rebuilt by generate.py — show the rows, refuse the edit. */
  readOnly?: boolean;
};

export function ObjectArrayEditor({ itemFields, value, onChange, readOnly }: Props) {
  const rows = Array.isArray(value) ? (value as Row[]) : [];

  function updateRow(index: number, key: string, fieldValue: unknown) {
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: fieldValue } : row)));
  }

  function addRow() {
    const blank: Row = {};
    // Read-only cells are derived at build time; seeding them with a blank
    // would ship an empty `furigana` the schema rejects.
    for (const field of itemFields) {
      if (!field.readOnly) blank[field.key] = defaultForKind(field.kind);
    }
    onChange([...rows, blank]);
  }

  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  return (
    <div className="edit-array">
      {rows.length === 0 ? <p className="panel-muted">No entries.</p> : null}
      {rows.map((row, index) => (
        <div className="edit-array-row" key={index}>
          <div className="edit-array-row__controls">
            <button type="button" onClick={() => moveRow(index, -1)} disabled={readOnly || index === 0} title="Move up">
              ↑
            </button>
            <button type="button" onClick={() => moveRow(index, 1)} disabled={readOnly || index === rows.length - 1} title="Move down">
              ↓
            </button>
            <button type="button" onClick={() => removeRow(index)} className="edit-array-row__remove" disabled={readOnly} title="Remove">
              ✕
            </button>
          </div>
          {itemFields.map((field) => (
            <label className="edit-field" key={field.key}>
              <span className="edit-field__label">{field.label}</span>
              <ScalarControl
                kind={field.kind}
                value={row[field.key]}
                onChange={(v) => updateRow(index, field.key, v)}
                readOnly={readOnly || field.readOnly}
              />
            </label>
          ))}
        </div>
      ))}
      <button type="button" className="edit-array__add" onClick={addRow} disabled={readOnly}>
        + Add
      </button>
    </div>
  );
}

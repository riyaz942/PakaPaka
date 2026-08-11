import { useEffect, useState } from 'react';
import { EDIT_SCHEMAS } from '../../lib/editSchema';
import type { ContentType } from '../../types/api';
import { ObjectArrayEditor } from './ObjectArrayEditor';
import { ScalarControl, SelectControl } from './ScalarControl';

type Props = {
  type: ContentType;
  slug: string;
  initialRaw: Record<string, unknown>;
  onCancel: () => void;
  onSaved: () => void;
};

export function EditForm({ type, slug, initialRaw, onCancel, onSaved }: Props) {
  const [draft, setDraft] = useState<Record<string, unknown>>(() => structuredClone(initialRaw));
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[] | null>(null);

  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  function setField(key: string, value: unknown) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function handleCancel() {
    if (dirty && !window.confirm('Discard unsaved changes?')) {
      return;
    }
    onCancel();
  }

  async function handleSave() {
    setSaving(true);
    setErrors(null);
    try {
      const res = await fetch(`/api/item/${type}/${slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const body = await res.json();
      if (!res.ok || body.ok === false) {
        setErrors(body.errors ?? ['Save failed']);
        return;
      }
      setDirty(false);
      onSaved();
    } catch (err) {
      setErrors([err instanceof Error ? err.message : 'Save failed']);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="panel edit-form">
      <div className="edit-form__header">
        <h3 className="panel-title">Edit</h3>
        {dirty ? <span className="edit-dirty-indicator">unsaved changes</span> : null}
      </div>

      {errors ? (
        <ul className="edit-error-list">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      ) : null}

      {EDIT_SCHEMAS[type].map((field) => (
        <label className="edit-field" key={field.key}>
          <span className="edit-field__label">{field.label}</span>
          {field.kind === 'select' ? (
            <SelectControl value={draft[field.key]} onChange={(v) => setField(field.key, v)} options={field.options} />
          ) : field.kind === 'objectArray' ? (
            <ObjectArrayEditor
              itemFields={field.itemFields}
              value={draft[field.key]}
              onChange={(rows) => setField(field.key, rows)}
            />
          ) : (
            <ScalarControl kind={field.kind} value={draft[field.key]} onChange={(v) => setField(field.key, v)} />
          )}
        </label>
      ))}

      <div className="edit-actions">
        <button type="button" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={handleCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}

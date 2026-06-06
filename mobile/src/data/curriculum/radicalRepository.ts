import type { SQLiteDatabase } from 'expo-sqlite';

import type { RadicalItem } from '@/data/curriculum/curriculum.types';

type RadicalRow = {
  id: number | string;
  slug: string;
  primary_form: string;
  meaning: string;
  mnemonic_text: string | null;
  visual_mnemonic_url: string | null;
  sort_order: number;
};

function mapRowToRadicalItem(row: RadicalRow): RadicalItem {
  return {
    id: String(row.id),
    slug: row.slug,
    primaryForm: row.primary_form,
    meaning: row.meaning,
    mnemonicText: row.mnemonic_text,
    visualMnemonicUrl: row.visual_mnemonic_url,
    sortOrder: row.sort_order,
  };
}

export function listRadicalsByLevel(db: SQLiteDatabase, jlptLevel: string): RadicalItem[] {
  const rows = db.getAllSync<RadicalRow>(
    `SELECT id, slug, primary_form, meaning, mnemonic_text, visual_mnemonic_url, sort_order
     FROM items
     WHERE item_type = 'radical' AND jlpt_level = ?
     ORDER BY sort_order ASC`,
    jlptLevel,
  );

  return rows.map(mapRowToRadicalItem);
}

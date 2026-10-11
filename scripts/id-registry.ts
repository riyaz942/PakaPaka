import fs from 'node:fs';
import path from 'node:path';

export const ID_REGISTRY_FILE = 'id-registry.json';

/**
 * One id space in curriculum.db. `ids` maps a natural key to its permanent id.
 * A key that leaves the build moves to `retired` and keeps its id, so the id
 * never goes to a different key. `aliases` maps an old key to the key that
 * replaced it: the new key resolves to the old key's id, so a rename after
 * launch does not move progress in user.db.
 */
export type IdRegistrySection = {
  next_id: number;
  ids: Record<string, number>;
  retired: Record<string, number>;
  aliases: Record<string, string>;
};

/** `curriculum/id-registry.json`: one section for each table whose ids user.db stores. */
export type IdRegistry = {
  /** `<item_type>:<slug>` → `items.id` */
  items: IdRegistrySection;
  /** `passage:<slug>` → `reading_passages.id` */
  passages: IdRegistrySection;
  /** `<passage-slug>#<question index>` → `passage_questions.id` */
  passage_questions: IdRegistrySection;
};

export type IdRegistrySectionName = keyof IdRegistry;

export function emptyIdRegistrySection(): IdRegistrySection {
  return { next_id: 1, ids: {}, retired: {}, aliases: {} };
}

export function readIdRegistry(curriculumDir: string): IdRegistry | null {
  const filePath = path.join(curriculumDir, ID_REGISTRY_FILE);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as IdRegistry;
}

function sortedByValue(record: Record<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(record).sort(([, a], [, b]) => a - b));
}

function sortedByKey<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(record).sort(([a], [b]) => a.localeCompare(b)));
}

/** Ids in ascending order, so a new id is always a new last line in the diff. */
export function writeIdRegistry(curriculumDir: string, registry: IdRegistry): void {
  const normalize = (section: IdRegistrySection): IdRegistrySection => ({
    next_id: section.next_id,
    ids: sortedByValue(section.ids),
    retired: sortedByValue(section.retired),
    aliases: sortedByKey(section.aliases),
  });
  const output: IdRegistry = {
    items: normalize(registry.items),
    passages: normalize(registry.passages),
    passage_questions: normalize(registry.passage_questions),
  };
  fs.writeFileSync(
    path.join(curriculumDir, ID_REGISTRY_FILE),
    `${JSON.stringify(output, null, 2)}\n`,
  );
}

function checkSectionIntegrity(section: IdRegistrySection, label: string): void {
  const ownerById = new Map<number, string>();
  for (const [key, id] of [...Object.entries(section.ids), ...Object.entries(section.retired)]) {
    const owner = ownerById.get(id);
    if (owner !== undefined) {
      throw new Error(`${label}: id ${id} belongs to both ${owner} and ${key}`);
    }
    ownerById.set(id, key);
    if (id >= section.next_id) {
      throw new Error(`${label}: ${key} has id ${id}, but next_id is ${section.next_id}`);
    }
  }
  for (const key of Object.keys(section.ids)) {
    if (key in section.retired) {
      throw new Error(`${label}: ${key} is in both ids and retired`);
    }
  }
}

/**
 * Permanent ids for `keys`. A key in the registry keeps its recorded id; an
 * alias target resolves to the id of its old key. Without `updateRegistry`, a
 * key with no id, or a registry key that is not in the build, fails the
 * compile, so CI never mints or drops an id. With it, a new key gets
 * `next_id`, a retired key that comes back gets its old id, and a key that
 * left the build moves to `retired`.
 *
 * New ids are given in the order of `keys`. The input section is not changed.
 */
export function resolveRegistryIds(
  section: IdRegistrySection,
  name: IdRegistrySectionName,
  keys: string[],
  updateRegistry: boolean,
): { idByKey: Map<string, number>; section: IdRegistrySection } {
  const label = `${ID_REGISTRY_FILE} ${name}`;
  checkSectionIntegrity(section, label);

  const next: IdRegistrySection = {
    next_id: section.next_id,
    ids: { ...section.ids },
    retired: { ...section.retired },
    aliases: { ...section.aliases },
  };

  const oldKeyByAlias = new Map<string, string>();
  for (const [oldKey, newKey] of Object.entries(section.aliases)) {
    const other = oldKeyByAlias.get(newKey);
    if (other !== undefined) {
      throw new Error(`${label}: aliases ${other} and ${oldKey} both point at ${newKey}`);
    }
    if (newKey in section.ids) {
      throw new Error(`${label}: alias ${oldKey} -> ${newKey}, but ${newKey} also has its own id`);
    }
    oldKeyByAlias.set(newKey, oldKey);
  }

  const idByKey = new Map<string, number>();
  const unknown: string[] = [];
  const presentRegistryKeys = new Set<string>();
  for (const key of keys) {
    if (idByKey.has(key)) {
      throw new Error(`${label}: the build has ${key} two times`);
    }
    const registryKey = key in next.ids ? key : (oldKeyByAlias.get(key) ?? key);
    if (registryKey in next.ids) {
      if (presentRegistryKeys.has(registryKey)) {
        throw new Error(`${label}: two keys in the build resolve to the id of ${registryKey}`);
      }
      idByKey.set(key, next.ids[registryKey]);
      presentRegistryKeys.add(registryKey);
      continue;
    }
    if (!updateRegistry) {
      unknown.push(key);
      continue;
    }
    if (key in next.retired) {
      next.ids[key] = next.retired[key];
      delete next.retired[key];
    } else {
      next.ids[key] = next.next_id;
      next.next_id += 1;
    }
    idByKey.set(key, next.ids[key]);
    presentRegistryKeys.add(key);
  }

  const missing = Object.keys(next.ids).filter((key) => !presentRegistryKeys.has(key));

  if (!updateRegistry && (unknown.length > 0 || missing.length > 0)) {
    const problems: string[] = [];
    if (unknown.length > 0) {
      problems.push(`${unknown.length} key(s) have no id: ${unknown.join(', ')}`);
    }
    if (missing.length > 0) {
      problems.push(
        `${missing.length} registry key(s) are not in the build: ${missing.join(', ')}`,
      );
    }
    throw new Error(
      `${label}: ${problems.join('; ')}. If this change is intended, run ` +
        '`npm run compile-curriculum -- --update-registry` and commit the registry.',
    );
  }

  for (const key of missing) {
    next.retired[key] = next.ids[key];
    delete next.ids[key];
  }

  return { idByKey, section: next };
}

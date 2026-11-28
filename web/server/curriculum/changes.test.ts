import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import express from 'express';

import { createCurriculumRouter } from './api.js';
import { changedItemKeys, changedSlugs } from './changes.js';

test('changedSlugs lists new and edited slugs, not removed or equal ones', () => {
  const before = new Map([
    ['same', '{"a":1}'],
    ['edited', '{"a":1}'],
    ['removed', '{"a":1}'],
  ]);
  const after = new Map([
    ['same', '{"a":1}'],
    ['edited', '{"a":2}'],
    ['added', '{"a":1}'],
  ]);
  assert.deepEqual([...changedSlugs(before, after)].sort(), ['added', 'edited']);
});

function write(root: string, rel: string, data: unknown): void {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function git(root: string, ...args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

test('changedItemKeys compares items and sidecars with a git revision, uncommitted edits included', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-changes-'));
  git(root, 'init', '-q');
  git(root, 'config', 'user.email', 'test@example.com');
  git(root, 'config', 'user.name', 'test');

  write(root, 'curriculum/grammar/items.json', {
    items: [
      { slug: 'wa-topic', level: 1 },
      { slug: 'ga', level: 2 },
    ],
  });
  write(root, 'curriculum/grammar/mnemonics.json', {
    'wa-topic': { mnemonic_text: 'old' },
  });
  write(root, 'curriculum/readings/items.json', { passages: [{ slug: 'p1', level: 13 }] });
  git(root, 'add', '.');
  git(root, 'commit', '-q', '-m', 'base');
  const base = git(root, 'rev-parse', 'HEAD');

  // A sidecar-only edit, a level move, and a file that did not exist at base.
  write(root, 'curriculum/grammar/mnemonics.json', {
    'wa-topic': { mnemonic_text: 'new' },
  });
  write(root, 'curriculum/grammar/items.json', {
    items: [
      { slug: 'wa-topic', level: 1 },
      { slug: 'ga', level: 3 },
    ],
  });
  write(root, 'curriculum/kanji/items.json', { items: [{ slug: 'hi', level: 1 }] });

  const keys = changedItemKeys(root, base);
  assert.deepEqual([...keys].sort(), ['grammar:ga', 'grammar:wa-topic', 'kanji:hi']);
});

test('GET /api/level/:level returns that level only, in type then teaching order, with full content', async () => {
  const repo = path.resolve(import.meta.dirname, '../../..');
  const app = express();
  app.use('/api', createCurriculumRouter(repo, path.join(repo, 'web')));
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/level/1?days=7`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      level: number;
      levels: number[];
      items: { type: string; level: number; sortOrder: number; raw: unknown; changed: boolean }[];
    };
    assert.equal(body.level, 1);
    assert.ok(body.levels.includes(60));
    assert.ok(body.items.length > 0);
    assert.ok(body.items.every((i) => i.level === 1 && i.raw && typeof i.changed === 'boolean'));
    const order = ['radical', 'kanji', 'vocabulary', 'grammar', 'reading'];
    for (let n = 1; n < body.items.length; n += 1) {
      const a = body.items[n - 1];
      const b = body.items[n];
      const byType = order.indexOf(a.type) - order.indexOf(b.type);
      assert.ok(byType < 0 || (byType === 0 && a.sortOrder <= b.sortOrder));
    }

    assert.equal((await fetch(`http://127.0.0.1:${port}/api/level/61`)).status, 400);
    assert.equal((await fetch(`http://127.0.0.1:${port}/api/level/1?days=abc`)).status, 400);
  } finally {
    server.close();
  }
});

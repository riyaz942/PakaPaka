import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';

import express from 'express';

import { createCurriculumRouter } from './api.js';

import {
  mergeGrammarReviewStatus,
  persistGrammarMnemonicReviewStatus,
  readGrammarLessonStatus,
  readGrammarMnemonicStatus,
} from './sidecar.js';
import { saveItem, updateGrammarMnemonicReviewStatus, updateReviewStatus } from './writer.js';

const REPO = path.resolve(import.meta.dirname, '../../..');

/** A scratch repo: the real curriculum (minus _build) plus a draft mnemonic for wa-topic. */
function scratchRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-grammar-'));
  fs.cpSync(path.join(REPO, 'curriculum'), path.join(root, 'curriculum'), {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}_build`),
  });
  const sidecar = path.join(root, 'curriculum', 'grammar', 'mnemonics.json');
  fs.writeFileSync(
    sidecar,
    JSON.stringify({ 'wa-topic': { mnemonic_text: 'x', _meta: { review_status: 'draft' } } }, null, 2) + '\n',
  );
  return root;
}

function rowStatus(root: string, slug: string): unknown {
  const file = JSON.parse(fs.readFileSync(path.join(root, 'curriculum', 'grammar', 'n5.json'), 'utf8'));
  return file.items.find((i: { slug: string }) => i.slug === slug)._meta?.review_status;
}

test('merge keeps the least reviewed status, and none counts as absent', () => {
  assert.equal(mergeGrammarReviewStatus('reviewed', 'draft'), 'draft');
  assert.equal(mergeGrammarReviewStatus('reviewed', 'flagged_for_rewrite'), 'flagged_for_rewrite');
  assert.equal(mergeGrammarReviewStatus('reviewed', null), 'reviewed');
  assert.equal(mergeGrammarReviewStatus('none', 'draft'), 'draft');
  assert.equal(mergeGrammarReviewStatus('none', null), 'none');
});

test('reads the mnemonic and lesson statuses separately', () => {
  const root = scratchRepo();
  assert.equal(readGrammarMnemonicStatus(root, 'wa-topic'), 'draft');
  assert.equal(readGrammarMnemonicStatus(root, 'ga'), null);
  assert.equal(readGrammarLessonStatus(root, 'wa-topic'), 'reviewed');
});

test('mnemonic status writes only the sidecar', () => {
  const root = scratchRepo();
  const lesson = path.join(root, 'curriculum', 'grammar', 'lessons', 'wa-topic.md');
  const before = fs.readFileSync(lesson, 'utf8');
  assert.deepEqual(persistGrammarMnemonicReviewStatus(root, 'wa-topic', 'reviewed'), { ok: true });
  assert.equal(readGrammarMnemonicStatus(root, 'wa-topic'), 'reviewed');
  assert.equal(fs.readFileSync(lesson, 'utf8'), before);
});

test('mnemonic status refuses a point with no mnemonic entry', () => {
  const result = persistGrammarMnemonicReviewStatus(scratchRepo(), 'ga', 'reviewed');
  assert.equal(result.ok, false);
});

test('lesson status flip keeps the row at the mnemonic\'s draft', () => {
  const root = scratchRepo();
  assert.deepEqual(updateReviewStatus(root, 'grammar', 'N5', 'wa-topic', 'reviewed'), { ok: true });
  assert.equal(rowStatus(root, 'wa-topic'), 'draft');
});

test('mnemonic review lifts the row once the lesson is reviewed too', () => {
  const root = scratchRepo();
  assert.deepEqual(updateGrammarMnemonicReviewStatus(root, 'N5', 'wa-topic', 'reviewed'), { ok: true });
  assert.equal(rowStatus(root, 'wa-topic'), 'reviewed');
  assert.equal(readGrammarLessonStatus(root, 'wa-topic'), 'reviewed');
});

test('item response gives the lesson status apart from the merged row status', async () => {
  const root = scratchRepo();
  assert.deepEqual(updateReviewStatus(root, 'grammar', 'N5', 'wa-topic', 'reviewed'), { ok: true });

  const app = express();
  app.use('/api', express.json(), createCurriculumRouter(root, path.join(REPO, 'web')));
  const server = app.listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/api/item/grammar/wa-topic`);
    const body = (await res.json()) as Record<string, unknown>;
    assert.equal(body.reviewStatus, 'draft'); // the row: least reviewed of lesson and mnemonic
    assert.equal(body.lessonReviewStatus, 'reviewed');
    assert.equal(body.mnemonicReviewStatus, 'draft');
  } finally {
    server.close();
  }
});

test('a grammar point with no lesson file is an error, not status none', () => {
  const root = scratchRepo();
  fs.rmSync(path.join(root, 'curriculum', 'grammar', 'lessons', 'wa-topic.md'));
  assert.throws(() => readGrammarLessonStatus(root, 'wa-topic'), /no lesson/);
  const result = updateGrammarMnemonicReviewStatus(root, 'N5', 'wa-topic', 'reviewed');
  assert.equal(result.ok, false);
});

test('a grammar mnemonic edit writes plain text to the sidecar, without word markers', () => {
  const root = scratchRepo();
  const file = JSON.parse(fs.readFileSync(path.join(root, 'curriculum', 'grammar', 'n5.json'), 'utf8'));
  const row = file.items.find((i: { slug: string }) => i.slug === 'wa-topic');
  const edited = {
    ...row,
    mnemonic_text: 'Sei asks "<reading>Wha</reading>t?" {{12||私}}<reading>は</reading>{{13||学生}}です。',
  };
  assert.deepEqual(saveItem(root, 'grammar', 'N5', 'wa-topic', edited), { ok: true });
  const sidecar = JSON.parse(
    fs.readFileSync(path.join(root, 'curriculum', 'grammar', 'mnemonics.json'), 'utf8'),
  );
  assert.equal(sidecar['wa-topic'].mnemonic_text, 'Sei asks "<reading>Wha</reading>t?" 私<reading>は</reading>学生です。');
  // The shipped row is only a preview until generate.py runs; the sidecar is the source.
  assert.equal(Object.keys(sidecar).length, 1);
});

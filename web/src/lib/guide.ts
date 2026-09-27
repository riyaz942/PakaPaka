import type { ContentType, JlptLevel } from '../types/api';

/**
 * The generation playbook, as data. Everything the Guide page renders — the
 * stage order, the commands, the audit fix cards — comes from here, and the
 * field → stage map other pages deep-link through is derived from `produces`
 * so a link can never point at a stage that doesn't claim the field.
 *
 * Source runbooks: docs/workflows/*.md. Audit check titles must match the
 * section titles in curriculum/_build/generate_content/audit_shipped.py
 * verbatim — that string is the `check` value the API reports.
 */

/** Replaced with the selected level at render time (`n5` / `n4`). */
export const LEVEL_TOKEN = '<level>';

export type GuideStep = {
  title: string;
  detail?: string;
  commands?: string[];
};

export type GuideLane = {
  id: string;
  label: string;
  summary: string;
  /** Runbook under docs/workflows/, shown as a path (the repo isn't served). */
  runbook?: string;
  steps: GuideStep[];
};

export type ProducedField = {
  type: ContentType;
  field: string;
  /** Shown next to the gap count when the raw number needs context. */
  note?: string;
  /**
   * Counted by `completeness` but not actually owed for every item — an
   * absence is a legitimate editorial outcome, not work left to do. Kept out
   * of the stage's headline count so it can't make a finished stage look open.
   */
  optional?: boolean;
};

export type GuideStage = {
  id: string;
  title: string;
  /** One line: what this stage puts on the page for the learner. */
  what: string;
  /** Completeness fields this stage fills — drives every gap number. */
  produces: ProducedField[];
  /** Stage ids that must be settled first. */
  requires: string[];
  requiresNote?: string;
  lanes: GuideLane[];
  /** Run after a batch, in order. */
  finish?: string[];
  finishNote?: string;
};

const BUILD_DIR_NOTE = 'All generator commands run from `curriculum/_build` with its existing venv.';

const PY = '.venv/bin/python';

function assembleSteps(): string[] {
  return [
    `cd curriculum/_build && ${PY} generate.py --level ${LEVEL_TOKEN} && cd -`,
    'npm run validate-schema',
    'npm run compile-curriculum',
  ];
}

function mnemonicLanes(kind: 'radical' | 'kanji' | 'vocab'): GuideLane[] {
  const dir = kind === 'vocab' ? 'vocab' : kind;
  return [
    {
      id: 'web-chat',
      label: 'Web chat',
      summary:
        'You (or the agent) paste each item’s prompt into a fresh Gemini/Claude chat and feed the reply back through the same gate the API path uses.',
      runbook: 'docs/workflows/radical-kanji-vocab-mnemonic-web-chat-workflow.md',
      steps: [
        {
          title: 'List what is still missing',
          detail:
            'The remaining-items snippet in the runbook prints a comma list in curriculum order. Or use the “open list” link above — the slugs are the same set.',
          commands: [
            'cd curriculum/_build',
          ],
        },
        {
          title: 'Build the prompts',
          detail:
            '`--slugs` is one comma-separated string with no spaces. Omit it to generate prompts for every item of the type.',
          commands: [
            `${PY} -m generate_content.generate_mnemonics webprompts --type ${kind} --level ${LEVEL_TOKEN} --slugs <slug,slug,...>`,
          ],
        },
        {
          title: 'Paste into a fresh chat, one item per chat',
          detail:
            `Open generate_content/web/mnemonics/${LEVEL_TOKEN}/${dir}/<slug>.prompt.md and paste everything BELOW the <!-- --> header — the header is an instruction to you, not part of the prompt. The taught decomposition, target reading, look-alikes and cast character are already baked in; never pick those yourself.`,
        },
        {
          title: 'Save the whole reply',
          detail: `Into generate_content/web/mnemonics/${LEVEL_TOKEN}/${dir}/<slug>.reply.md — filename must match the slug. Chatter around the fenced JSON block is fine; ingest extracts the object.`,
        },
        {
          title: 'Ingest — this is the gate',
          detail:
            'On pass it merges into the sidecar (curriculum/<type>/mnemonics.json) as `review_status: draft`. On failure nothing is merged and the gate errors are appended to the prompt file: re-paste that rewritten prompt and try again. If an item fights the gate 3+ times, skip it and come back.',
          commands: [
            `${PY} -m generate_content.generate_mnemonics ingest --type ${kind} --level ${LEVEL_TOKEN} --slug <slug> --model gemini-web`,
          ],
        },
      ],
    },
    {
      id: 'subagent',
      label: 'Subagent',
      summary:
        'No browser. Claude Code runs the same webprompts/ingest commands and produces each reply with a fresh subagent — one per small group of related items so their scenes stay distinct.',
      runbook:
        'docs/workflows/radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md',
      steps: [
        {
          title: 'Hand the automation prompt to Claude Code',
          detail:
            'Open the runbook, set the level / batch size / subagent model at the top, and give it to the agent. It selects the next un-generated items itself — do not paste a slug list.',
        },
        {
          title: 'Same gate, same sidecar',
          detail:
            'Ingestion and repair stay per item, exactly as in the web-chat lane. Provenance is recorded honestly in `_meta.generator_model`.',
        },
      ],
    },
  ];
}

function exampleLanes(kind: 'vocab'): GuideLane[] {
  return [
    {
      id: 'web-chat',
      label: 'Web chat',
      summary:
        'Same loop as mnemonics: prompt file → fresh chat → reply file → ingest. The gate rejects a set that doesn’t use the target, references vocabulary outside the allowed list, contains an out-of-level word, or fails the furigana round-trip.',
      runbook: 'docs/workflows/example-sentences-web-chat-workflow.md',
      steps: [
        {
          title: 'Build the prompts',
          detail:
            'Only vocab gets example sentences here. Kanji get none (the app lists the vocabulary written with them), radicals get none, and grammar examples are authored with the grammar lessons.',
          commands: [
            'cd curriculum/_build',
            `${PY} -m generate_content.generate_examples webprompts --type ${kind} --level ${LEVEL_TOKEN} --slugs <slug,slug,...>`,
          ],
        },
        {
          title: 'Paste, one item per fresh chat',
          detail: `generate_content/web/examples/${LEVEL_TOKEN}/${kind}/<slug>.prompt.md — everything below the <!-- --> header. Tatoeba lines in the prompt are style anchors only; no Tatoeba text is ever shipped.`,
        },
        {
          title: 'Save the reply',
          detail: `generate_content/web/examples/${LEVEL_TOKEN}/${kind}/<slug>.reply.md. Each sentence needs \`japanese\`, \`english\`, and \`vocabulary_slugs\` — plain Japanese only, no furigana (the tokenizer adds it at build).`,
        },
        {
          title: 'Ingest — this is the gate',
          commands: [
            `${PY} -m generate_content.generate_examples ingest --type ${kind} --level ${LEVEL_TOKEN} --slug <slug> --model gemini-web`,
          ],
        },
        {
          title: 'Pilot before you commit to a level',
          detail:
            'Run ~10 items and read the assembled output before widening. A bad prompt tune shows up fastest on a small batch.',
        },
      ],
    },
    {
      id: 'subagent',
      label: 'Subagent',
      summary: 'Same commands and same gate, replies produced by in-session subagents instead of a browser.',
      runbook: 'docs/workflows/example-sentences-subagent-workflow-automation-prompt.md',
      steps: [
        {
          title: 'Hand the automation prompt to Claude Code',
          detail: 'Set level, batch size and subagent model at the top of the runbook; it auto-selects the next un-generated items.',
        },
      ],
    },
  ];
}

export const GUIDE_STAGES: GuideStage[] = [
  {
    id: 'facts',
    title: 'Fact skeleton',
    what:
      'Readings, accepted answers, furigana and accepted forms — imported from open sources, not written by a model. Everything else is built on top of this.',
    produces: [
      { type: 'kanji', field: 'readings' },
      { type: 'kanji', field: 'accepted_answers' },
      { type: 'vocabulary', field: 'furigana' },
      { type: 'vocabulary', field: 'accepted_answers' },
      {
        type: 'radical',
        field: 'accepted_answers',
        optional: true,
        note: 'schema-optional for radicals — most omit it deliberately, so a high count here is not a gap to fill',
      },
      { type: 'grammar', field: 'accepted_forms' },
    ],
    requires: [],
    lanes: [
      {
        id: 'deterministic',
        label: 'Deterministic',
        summary:
          'No model involved. Sources are fetched, the per-level fact modules under curriculum/_build build the item lists, and generate.py assembles the shipped JSON.',
        steps: [
          {
            title: 'Fetch the source data',
            detail:
              'Dictionary and frequency sources. Add `--tatoeba` if you want real-usage style anchors in the example-sentence prompts (optional — the gate is unaffected without them).',
            commands: ['cd curriculum/_build', 'import/fetch_sources.sh'],
          },
          {
            title: 'Assemble the shipped JSON',
            detail:
              'generate.py inlines every sidecar (mnemonics, examples) into curriculum/<type>/<level>.json and adds tokenizer furigana. Run it for the level you touched.',
            commands: [`${PY} generate.py --level ${LEVEL_TOKEN}`],
          },
          {
            title: 'Rebuild the dependency graph',
            detail:
              'Rewrites curriculum/dependencies/graph.json from the generated JSON. Needed whenever items or decompositions changed.',
            commands: [`${PY} generate_deps.py`],
          },
        ],
      },
    ],
    finish: ['npm run validate-schema', 'npm run compile-curriculum'],
  },
  {
    id: 'mnemonics-radical',
    title: 'Radical mnemonics',
    what: 'The story a radical is taught with — its `mnemonic_text`, plus a `description` when it needs one.',
    produces: [
      { type: 'radical', field: 'mnemonic_text' },
      {
        type: 'radical',
        field: 'description',
        optional: true,
        note: 'optional — written only where the item has reviewed look-alikes to contrast or a nuance the mnemonic cannot carry',
      },
    ],
    requires: ['facts'],
    requiresNote:
      'Radicals come first in the whole content chain: a kanji story continues its radicals’ descriptions, so nothing above this layer can be generated until it is settled.',
    lanes: mnemonicLanes('radical'),
    finish: assembleSteps(),
    finishNote:
      'Re-run generate.py between layers — the next layer’s prompts read this layer’s prose out of the shipped JSON.',
  },
  {
    id: 'mnemonics-kanji',
    title: 'Kanji mnemonics',
    what: 'Meaning mnemonic built from the taught radicals, reading mnemonic carrying the primary reading, and a description contrasting reviewed look-alikes.',
    produces: [
      { type: 'kanji', field: 'meaning_mnemonic' },
      { type: 'kanji', field: 'reading_mnemonic' },
      {
        type: 'kanji',
        field: 'description',
        optional: true,
        note: 'required only where the kanji has reviewed look-alikes to contrast',
      },
    ],
    requires: ['facts', 'mnemonics-radical'],
    requiresNote:
      'The prompt injects each taught radical’s established `mnemonic_text` so the story continues that image. Generate kanji only after the radicals it builds on are written — ideally reviewed.',
    lanes: mnemonicLanes('kanji'),
    finish: assembleSteps(),
  },
  {
    id: 'mnemonics-vocab',
    title: 'Vocabulary mnemonics',
    what: 'Meaning mnemonic hooked into the component kanji’s stories, and a reading mnemonic — or a one-line derivation note when the reading is mechanically regular.',
    produces: [
      { type: 'vocabulary', field: 'meaning_mnemonic' },
      { type: 'vocabulary', field: 'reading_mnemonic' },
    ],
    requires: ['mnemonics-kanji'],
    requiresNote:
      'The vocab prompt carries the component kanji’s meaning mnemonics. Kanji must be generated and re-assembled first, or the prompt has nothing to hook into.',
    lanes: mnemonicLanes('vocab'),
    finish: assembleSteps(),
  },
  {
    id: 'examples-vocab',
    title: 'Vocabulary example sentences',
    what: 'Two to four sentences per word, every content word inside the allowed vocabulary, furigana added by the tokenizer at build.',
    produces: [{ type: 'vocabulary', field: 'example_sentences' }],
    requires: ['facts'],
    requiresNote:
      'Independent of the mnemonic layers — the allowed-vocab list comes from sort order, not from prose.',
    lanes: exampleLanes('vocab'),
    finish: assembleSteps(),
  },
  {
    id: 'grammar',
    title: 'Grammar lessons',
    what: 'The lesson markdown a grammar point is taught with, its caution notes, and its example sentences.',
    produces: [
      { type: 'grammar', field: 'explanation_markdown' },
      { type: 'grammar', field: 'caution_notes' },
      { type: 'grammar', field: 'example_sentences' },
    ],
    requires: ['facts'],
    requiresNote:
      'Work in curriculum order so contrast sections reference points you have already written, and finish N5 before N4 — N4 lessons may use all N5 vocabulary.',
    lanes: [
      {
        id: 'web-chat',
        label: 'Web chat',
        summary:
          'Allowed vocabulary, taught siblings and style anchors are computed into each prompt. The model never writes furigana — the build adds it mechanically.',
        runbook: 'docs/workflows/grammar-web-chat-workflow.md',
        steps: [
          {
            title: 'Build the prompts',
            commands: [
              'cd curriculum/_build',
              `${PY} -m generate_content.generate_grammar_lessons webprompts --level ${LEVEL_TOKEN} --slugs <slug,slug,...>`,
            ],
          },
          {
            title: 'Paste, one point per fresh chat',
            detail: `generate_content/web/${LEVEL_TOKEN}/<slug>.prompt.md — the whole block below the header.`,
          },
          {
            title: 'Save the reply',
            detail: `generate_content/web/${LEVEL_TOKEN}/<slug>.reply.md`,
          },
          {
            title: 'Ingest — this is the gate',
            detail:
              'On pass it assembles curriculum/grammar/lessons/<slug>.md as `review_status: draft` and stashes cloze candidates in drafts/. Common failures: a stray out-of-level word, or a fence that disagrees with `example_sentences`.',
            commands: [
              `${PY} -m generate_content.generate_grammar_lessons ingest --level ${LEVEL_TOKEN} --slug <slug> --model gemini-web`,
            ],
          },
        ],
      },
      {
        id: 'subagent',
        label: 'Subagent',
        summary:
          'Same commands and same gate, lessons written by in-session subagents instead of a browser. One subagent per point — no grouping.',
        runbook: 'docs/workflows/grammar-subagent-workflow-automation-prompt.md',
        steps: [
          {
            title: 'Hand the automation prompt to Claude Code',
            detail:
              'Set level, batch size and subagent model at the top of the runbook; it auto-selects the next unwritten points in curriculum order. Keep the batch small — a lesson is long to generate and longer to review.',
          },
        ],
      },
    ],
    finish: assembleSteps(),
    finishNote: 'Grammar lessons are the highest-leverage content and the most expensive to review — read every one in the app’s lesson renderer before flipping it to reviewed.',
  },
  {
    id: 'cloze',
    title: 'Cloze variants',
    what: 'The fill-in-the-blank review cards for a grammar point. Candidates fall out of grammar ingest; promoting them is editorial work, not a generation run.',
    produces: [{ type: 'grammar', field: 'cloze_variants' }],
    requires: ['grammar'],
    lanes: [
      {
        id: 'manual',
        label: 'By hand',
        summary:
          'Grammar ingest writes candidates to generate_content/drafts/<level>/<slug>-cloze-candidates.json. Promote the good ones onto the grammar item, then run the gate.',
        steps: [
          {
            title: 'Open the candidates',
            detail: `generate_content/drafts/${LEVEL_TOKEN}/<slug>-cloze-candidates.json`,
          },
          {
            title: 'Edit the grammar item',
            detail:
              'Paste the variants you want into `cloze_variants` using this studio’s Edit form on the grammar item, or edit curriculum/grammar/<level>.json directly. Every save is schema-validated before it touches disk.',
          },
          {
            title: 'Run the cloze gate',
            detail:
              'No nudge may contain its own answer, its accepted forms, or its gloss; the answer must be in `accepted_forms`; the filled sentence must stay in level.',
            commands: [
              'cd curriculum/_build',
              `${PY} -m generate_content.check_cloze --level ${LEVEL_TOKEN}`,
            ],
          },
        ],
      },
    ],
    finish: ['npm run validate-schema', 'npm run compile-curriculum'],
  },
  {
    id: 'passages',
    title: 'Reading passages',
    what: 'The passages the Browse surface unlocks at 90% Guru+ coverage: body, translation, summaries, questions and derived spans.',
    produces: [
      { type: 'reading', field: 'body_furigana' },
      { type: 'reading', field: 'english_translation' },
      { type: 'reading', field: 'summary_ja' },
      { type: 'reading', field: 'summary_en' },
      { type: 'reading', field: 'word_spans' },
      { type: 'reading', field: 'grammar_slugs' },
      { type: 'reading', field: 'vocabulary_slugs' },
      { type: 'reading', field: 'questions' },
    ],
    requires: ['facts', 'grammar', 'examples-vocab'],
    requiresNote:
      'A passage is written against a seed’s allowed vocabulary and grammar cutoff, so the grammar points it may use must exist first. The unit of work is a seed (topic, tone, length band, question count) from reading_seeds.py — not a slug you pick.',
    lanes: [
      {
        id: 'subagent',
        label: 'Subagent',
        summary:
          'The only lane for passages. One fresh subagent per seed, auto-selected from the seeds that have not yet passed the gate — stopping and resuming across sessions is free.',
        runbook: 'docs/workflows/reading-passages-subagent-workflow-automation-prompt.md',
        steps: [
          {
            title: 'Hand the automation prompt to Claude Code',
            detail:
              'Set the level and batch size at the top. Start with batch size 1 and read the passage before running more — a passage is far more expensive per item than a sentence, and tone is exactly what a gate cannot check.',
          },
          {
            title: 'What it runs',
            detail:
              'The same webprompts/ingest pair as every other lane, against the seed list.',
            commands: [
              'cd curriculum/_build',
              `${PY} -m generate_content.generate_readings webprompts --level ${LEVEL_TOKEN} --slugs <auto-selected seeds>`,
              `${PY} -m generate_content.generate_readings ingest --level ${LEVEL_TOKEN} --slug <seed> --model <model>`,
            ],
          },
        ],
      },
    ],
    finish: assembleSteps(),
  },
  {
    id: 'radical-art',
    title: 'Radical mnemonic art',
    what: 'The illustrated card shown next to a radical’s mnemonic. Radicals only — kanji, vocabulary and grammar get text mnemonics and no art.',
    produces: [{ type: 'radical', field: 'visual_mnemonic_url' }],
    requires: ['mnemonics-radical'],
    requiresNote:
      'Text first, art second: a radical’s `mnemonic_text` must already be `reviewed`, because the picture is drawn from the prose. The batch selector skips radicals whose mnemonic is not reviewed — if it selects nothing, that is why.',
    lanes: [
      {
        id: 'manual',
        label: 'Manual (Gemini web)',
        summary:
          'The browser is deliberately not automated here — hand-driving Gemini proved more reliable, and it puts you in front of every image as it appears. The agent does the bookkeeping either side.',
        runbook: 'docs/workflows/radical-art-web-chat-workflow.md',
        steps: [
          {
            title: 'Agent: build the batch',
            detail:
              'Ask for prompts for the next N radicals. It auto-selects radicals with no art whose mnemonic is reviewed, and writes one self-contained prompt (style block + scene) per radical. Needs `cwebp` on PATH — brew install webp libtiff.',
          },
          {
            title: 'You: generate',
            detail:
              'One fresh Gemini chat per radical, that radical’s whole prompt as the only message. Download the image and leave it in ~/Downloads.',
          },
          {
            title: 'Agent: install',
            detail:
              'It matches each download to its radical, converts to WebP, installs it as mobile/assets/radicals/<slug>.webp, regenerates radicalImages.ts and runs the gates.',
          },
          {
            title: 'You: judge, then re-roll',
            detail:
              'The agent does not rate the art. Open the installed images, say “all good” or name the slugs to redo and why.',
          },
        ],
      },
    ],
    finish: ['npm run validate-schema', 'npm run compile-curriculum'],
  },
  {
    id: 'review',
    title: 'Human review',
    what:
      'The gates prove content is in-constraints; they do not prove it is good. Nothing ships as `draft` — this is the step that turns generated content into shippable content.',
    produces: [],
    requires: [],
    requiresNote: 'Applies to every stage above, after each batch.',
    lanes: [
      {
        id: 'manual',
        label: 'In this studio',
        summary:
          'Read the assembled content, then flip its status. Use the Content tab filtered to Draft, and the review-status control on each item’s detail page.',
        steps: [
          {
            title: 'Read it where the learner sees it',
            detail:
              'Grammar lessons in the app’s lesson renderer; mnemonics and examples in item detail here. For mnemonics, also run a cross-batch cast-coherence pass — independent chats drift on the shared cast.',
          },
          {
            title: 'Flip the status',
            detail:
              'Item detail → review status control, or set `_meta.review_status` in the sidecar. Use `flagged_for_rewrite` for anything you want regenerated rather than silently leaving it draft.',
          },
          {
            title: 'Re-validate',
            detail:
              'compile-curriculum warns on draft content and CI can fail on it, so unreviewed prose cannot ship silently.',
            commands: ['npm run validate-schema', 'npm run compile-curriculum'],
          },
        ],
      },
    ],
  },
];

export type AuditFixSection = {
  id: string;
  title: string;
  /** Exact `check` strings from audit_shipped.py this card explains. */
  checks: string[];
  severityNote: string;
  what: string;
  fix: string[];
  commands?: string[];
};

export const AUDIT_FIXES: AuditFixSection[] = [
  {
    id: 'fix-gates',
    title: 'A draft gate fails on shipped content',
    checks: ['Re-run of existing draft gates on shipped content'],
    severityNote: 'ERROR, except the grammar example checks which are WARNING.',
    what:
      'The generation-time gates (mnemonics, examples, grammar examples, cloze, passages) re-run against what actually shipped. A finding here means content on disk would not pass the gate that produced it — usually because it was hand-edited afterwards, or generated under an older prompt version.',
    fix: [
      'Re-generate the item through its stage: `webprompts` for that one slug, paste, `ingest`. The gate errors are appended to the prompt file, so the model gets told exactly what it broke.',
      'Or fix the field directly in this studio’s Edit form — every save is schema-validated before it touches disk.',
      'The grammar “example contains neither an accepted form nor a taught contrast pattern” warnings are a literal substring match. A naturally conjugated example (くれる → くれました) fails mechanically without being wrong — read it before acting.',
    ],
  },
  {
    id: 'fix-accepted-answers',
    title: 'Accepted-answer invariants',
    checks: ['Accepted-answer invariants (check 1)'],
    severityNote: 'ERROR.',
    what:
      'Exactly one primary meaning answer, matching the item’s `meaning`; kanji reading answers must round-trip against `readings`; a vocabulary reading answer must match its `furigana`. These are fact-layer fields — a model never wrote them.',
    fix: [
      'Fix `accepted_answers` on the item in the Edit form for a one-off.',
      'If the import is wrong (the same shape repeating across many items), fix the fact module under curriculum/_build and re-assemble instead — otherwise the next build puts it back.',
    ],
    commands: [
      `cd curriculum/_build && ${PY} generate.py --level ${LEVEL_TOKEN} && cd -`,
      'npm run validate-schema',
    ],
  },
  {
    id: 'fix-decomposition',
    title: 'Decomposition gaps vs KRADFILE',
    checks: ['Graph decomposition completeness vs KRADFILE (check 3)'],
    severityNote: 'WARNING for a missing edge; INFO for untaught components.',
    what:
      'KRADFILE lists a component of a taught kanji that has no `builds_on` edge from a taught radical. The INFO lines are the other two shapes: a component taught nowhere, and a component taught as a kanji rather than a radical (where no edge is expressible at all).',
    fix: [
      'WARNING: add the missing edge to the dependency source and rebuild graph.json, or record the pair in `DECOMPOSITION_EXCEPTIONS` with a reason if the decomposition is deliberately not taught that way.',
      'INFO “taught nowhere”: a curriculum decision — author the radical, or accept that the kanji is taught without that component.',
      'INFO “taught as a kanji”: nothing to fix; the graph only carries radical → kanji edges.',
    ],
    commands: [`cd curriculum/_build && ${PY} generate_deps.py && cd -`, 'npm run validate-schema'],
  },
  {
    id: 'fix-mnemonic-tags',
    title: 'Mnemonic tag names an untaught component',
    checks: ['Mnemonic tag round-trip, reverse direction (check 4)'],
    severityNote: 'WARNING — needs a human read, not an automatic fix.',
    what:
      'A `<radical>` or `<kanji>` tag inside a meaning mnemonic matches none of the item’s taught components. Usually a stale tag left over from a decomposition edit, or the model naming something it was not given.',
    fix: [
      'If the tag names a component that isn’t taught, either drop the tag or rewrite the sentence — regenerating through the mnemonic stage is the cleaner fix.',
      'It can be legitimate: a story reaching into a component’s own sub-story (見る’s eye borrowing 見’s origin) trips the same loose match. Read it before changing anything.',
    ],
  },
  {
    id: 'fix-passage-grammar',
    title: 'Passage declares grammar it does not use',
    checks: ['Passage grammar actually used (check 5)'],
    severityNote: 'WARNING.',
    what:
      'A passage lists a slug in `grammar_slugs` but none of that point’s surface forms appear in the body. The learner-facing effect is a passage claiming to practise grammar it never shows.',
    fix: [
      'Drop the slug from `grammar_slugs` if the passage genuinely doesn’t use the point.',
      'Or regenerate the passage from its seed if the grammar was supposed to be exercised.',
    ],
  },
  {
    id: 'fix-lookalike-symmetry',
    title: 'Look-alike links are one-way or dangling',
    checks: ['Look-alike symmetry (check 7, corpus-wide)'],
    severityNote: 'ERROR.',
    what:
      '`visually_similar_slugs` either points at a slug that doesn’t exist, or names an item that doesn’t name it back. Look-alikes render as chips on both items, so a one-way link shows the contrast on one card and not the other.',
    fix: [
      'Edit both items so the link is mutual, or remove it from the one that has it.',
      'The reviewed pair dataset is curriculum/_build/visually_similar.py — fix it there and re-assemble, or the next build restores the asymmetry.',
    ],
    commands: [`cd curriculum/_build && ${PY} generate.py --level ${LEVEL_TOKEN} && cd -`],
  },
  {
    id: 'fix-hygiene',
    title: 'Corpus hygiene',
    checks: ['Corpus hygiene (check 8, corpus-wide)'],
    severityNote: 'Mixed — duplicates and count drift are ERROR, form collisions are WARNING.',
    what:
      'Duplicate slugs or sort_order values, a form taught twice across levels, a radical and kanji sharing a form with no edge between them, and metadata.json content_counts that disagree with what is on disk.',
    fix: [
      'Duplicate slug / sort_order: fix the item list in the level’s fact module — these are generated, not hand-authored.',
      '“Taught N times across levels”: the later level must reuse the first level’s slug rather than re-teaching the form, or the learner sees one shape as two review cards.',
      'Radical + kanji share a form with no `builds_on` edge: add the edge, otherwise the kanji ships with no component chip.',
      'content_counts drift: re-assemble and rebuild the graph — the counts are written from the corpus, so drift means the last build was skipped.',
    ],
    commands: [
      `cd curriculum/_build && ${PY} generate.py --level ${LEVEL_TOKEN} && ${PY} generate_deps.py && cd -`,
      'npm run validate-schema',
    ],
  },
  {
    id: 'fix-span-diff',
    title: 'Word spans are stale',
    checks: ['Span re-derivation diff (check 10)'],
    severityNote: 'WARNING for a diff; ERROR for an inflected span outside vocabulary_slugs.',
    what:
      'Shipped `word_spans` do not match what re-deriving them from the current text plus `vocabulary_slugs` produces. Compile only checks that spans are well-formed, not that they are current — so this is the staleness check, and it almost always means the text was edited after the last build.',
    fix: [
      'Re-assemble the level: spans are derived at build time, so generate.py rewrites them from the current text.',
      'The ERROR variant (an inflected span whose slug is not in `vocabulary_slugs`) breaks the unlock-bar invariant and means the JSON was hand-edited after compile — re-assemble, then re-run the audit to confirm it is gone.',
    ],
    commands: [
      `cd curriculum/_build && ${PY} generate.py --level ${LEVEL_TOKEN} && cd -`,
      'npm run compile-curriculum',
    ],
  },
  {
    id: 'fix-rollup',
    title: 'Review-status rollup',
    checks: ['Review-status rollup'],
    severityNote: 'INFO only — nothing here is a defect.',
    what:
      'The per-type count of draft / reviewed / flagged items. It is the human-review tracker, not a failure: a large draft count means content exists but has not been read yet.',
    fix: ['Work it down through the review step — read the content, then flip the status.'],
  },
];

export const AUDIT_COMMANDS: { title: string; detail: string; commands: string[] }[] = [
  {
    title: 'Deterministic audit (tiers 0–1)',
    detail:
      'What the “Run audit” button on the Audit tab shells out to. Takes a few minutes for both levels and writes curriculum/_build/reports/content-audit-<level>.{md,json}. The Content and item pages only reflect the most recent report on disk — re-run it after editing.',
    commands: [
      `cd curriculum/_build && ${PY} -m generate_content.audit_shipped --json --level n5 --level n4`,
    ],
  },
  {
    title: 'Schema + furigana validation',
    detail: 'Ajv schema plus furigana checks over curriculum/. The Validate button in the header runs exactly this.',
    commands: ['npm run validate-schema'],
  },
  {
    title: 'Compile',
    detail:
      'Compiles curriculum/ into SQLite and warns on draft content. From the Pipeline tab this writes to a scratch database (web/.build/curriculum.db); run it from the repo root when you actually want to update the shipped seed.',
    commands: ['npm run compile-curriculum'],
  },
  {
    title: 'Semantic audit (tier 2, advisory)',
    detail:
      'AI translation-fidelity pass, run through subagents. Only worth doing once tiers 0–1 are green — ingest refuses to run without an existing report. It never edits content or flips review_status; it appends an advisory section for a human to read. See docs/workflows/semantic-audit-subagent-workflow-automation-prompt.md.',
    commands: [
      `cd curriculum/_build && ${PY} -m generate_content.audit_semantic webprompts --level ${LEVEL_TOKEN} --batch-size 40`,
    ],
  },
];

export const GUIDE_BUILD_NOTE = BUILD_DIR_NOTE;

const STAGE_BY_ID = new Map(GUIDE_STAGES.map((s) => [s.id, s]));

export function getStage(id: string): GuideStage | undefined {
  return STAGE_BY_ID.get(id);
}

/** `type:field` → stage id, derived from every stage's `produces`. */
const STAGE_BY_FIELD = new Map<string, string>();
for (const stage of GUIDE_STAGES) {
  for (const produced of stage.produces) {
    STAGE_BY_FIELD.set(`${produced.type}:${produced.field}`, stage.id);
  }
}

/** Which stage fills this completeness field, if any claims it. */
export function stageIdForField(
  type: ContentType,
  field: string,
): string | undefined {
  return STAGE_BY_FIELD.get(`${type}:${field}`);
}

/**
 * Where a content type's work usually starts. `facts` is deprioritised: it
 * produces a field for nearly every type, so taking the first match would send
 * every "how do I raise this percentage" click to the importer.
 */
export function stageIdForType(type: ContentType): string | undefined {
  const owns = (stage: GuideStage) =>
    stage.produces.some((p) => p.type === type && !p.optional);
  return (
    GUIDE_STAGES.find((stage) => stage.id !== 'facts' && owns(stage))?.id ??
    GUIDE_STAGES.find(owns)?.id
  );
}

/**
 * The stage holding this type's biggest actual gap, given a field → missing
 * count map (from `/api/gaps`). Falls back to `stageIdForType` when nothing
 * is missing, so the link still lands somewhere sensible.
 */
export function stageIdForTypeGap(
  type: ContentType,
  missing: Record<string, number> | undefined,
): string | undefined {
  let bestId: string | undefined;
  let bestCount = 0;
  for (const stage of GUIDE_STAGES) {
    for (const produced of stage.produces) {
      if (produced.type !== type || produced.optional) continue;
      const count = missing?.[produced.field] ?? 0;
      if (count > bestCount) {
        bestCount = count;
        bestId = stage.id;
      }
    }
  }
  return bestId ?? stageIdForType(type);
}

const FIX_BY_CHECK = new Map<string, string>();
for (const fix of AUDIT_FIXES) {
  for (const check of fix.checks) {
    FIX_BY_CHECK.set(check, fix.id);
  }
}

/** Guide anchor for an audit `check` string, if we have a fix card for it. */
export function fixIdForCheck(check: string): string | undefined {
  return FIX_BY_CHECK.get(check);
}

export function guideHref(anchor: string, level?: JlptLevel): string {
  return level ? `/guide?level=${level}#${anchor}` : `/guide#${anchor}`;
}

/** Deep link to the filtered list of items still missing a field. */
export function contentGapHref(
  type: ContentType,
  field: string,
  level: JlptLevel,
): string {
  return `/content/${type}?level=${level}&missing=${encodeURIComponent(field)}&sort=completeness_asc`;
}

export function withLevel(command: string, level: JlptLevel): string {
  return command.split(LEVEL_TOKEN).join(level.toLowerCase());
}

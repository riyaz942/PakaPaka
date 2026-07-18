Task: Generate N5 Kanji/Vocab Example Sentences via Gemini Web

Use the existing logged-in Gemini session in my Chrome browser to generate Phase 2c
example sentences. This run is for ONE content type at a time and **auto-selects the
next batch of not-yet-done slugs** for that type (Step 1) — you do NOT paste a slug
list.

Content type (one of `kanji` or `vocab`):

<type = kaji>

This is the browser-driven, no-API equivalent of the Message Batches driver in
`curriculum/_build/generate_content/generate_examples.py`. Only the "call the
model" step moves to the browser; the context builder, the allowed-vocab
constraints, the target-word requirement, and the mechanical gate are identical to
the API path. See `docs/workflows/example-sentences-web-chat-workflow.md`.

Note: there is NO `radical` type in this flow — radicals do not get example
sentences. The only content types are `kanji` and `vocab`.

Run size (BATCH_LIMIT = 10)

This run processes up to 10 slugs (BATCH_LIMIT, set in Step 1). Each slug is an
independent browser cycle — fresh chat, model/thinking verification, paste,
completion polling, download, ingest, and possibly a repair subagent — so a run's
cost in tool calls and accumulated context grows fast. 10 is tuned for a
lower-reasoning driver model (e.g. Claude Code Sonnet 5 "low"), where long sessions
are the main quality risk: as context fills, the driver starts skipping the
paste-integrity and stop-button checks and silently corrupts replies. If the driver
is clearly holding up, you can raise BATCH_LIMIT toward 15; treat ~20 as the ceiling
before session degradation gets real, and prefer running the automation twice over
pushing a single run past it.

Browser Requirements

- Use Chrome, not Edge.
- If multiple browsers are connected:
  a. List all connected browsers.
  b. Determine which browser has an active Gemini session.
  c. Confirm you will use the logged-in Chrome instance before continuing.

---

Workflow

Process one slug at a time. Every slug must use a fresh Gemini chat with no shared
conversation context. Do NOT mix content types in one run — all slugs in this run
share the same <type>.

Step 1: Select Slugs and Generate Prompts

Work from:

curriculum/_build

1a. Select this run's slugs automatically. Do NOT hand-pick or paste a slug list.
Pick the next BATCH_LIMIT slugs of <type> (in curriculum sort order) that are
neither generated (absent from the committed sidecar) nor drafted (no record under
`drafts/examples`). Substitute this run's <type> for KIND, then run:

.venv/bin/python - <<'PY'
import json, os, sys; sys.path.insert(0, '.')
from generate_content import example_context as ec
LEVEL, KIND, BATCH_LIMIT = 'n5', '<type>', 10   # KIND: 'vocab' or 'kanji'
subdir = 'vocabulary' if KIND == 'vocab' else 'kanji'
sidecar = f'../{subdir}/examples/{LEVEL}.json'
generated = set(json.load(open(sidecar))) if os.path.exists(sidecar) else set()
drafts_dir = f'generate_content/drafts/examples/{LEVEL}/{KIND}'
drafted = {n[:-5] for n in os.listdir(drafts_dir) if n.endswith('.json')} if os.path.isdir(drafts_dir) else set()
drafted.discard('requests-preview')
done = generated | drafted
todo = [s for s in ec.all_slugs(LEVEL, KIND) if s not in done][:BATCH_LIMIT]
print(f'{len(todo)} slug(s) selected (BATCH_LIMIT={BATCH_LIMIT}):')
print(','.join(todo))
PY

If it prints 0 slugs, this level+type is already fully generated/drafted — stop and
report that; do not open Gemini. Otherwise treat the printed comma list as this
run's slug set: every later step iterates over exactly these slugs, and no slug
outside this list is touched.

1b. Generate the prompt files for the selected slugs in one call. `--slugs` is a
single comma-separated string with NO spaces after the commas:

.venv/bin/python -m generate_content.generate_examples webprompts --type <type> --level n5 --slugs <selected,slugs,...>

Generating all prompts at once is fine, but each slug must still use its own fresh
Gemini chat. Each prompt file is written to:

curriculum/_build/generate_content/web/examples/n5/<type>/<slug>.prompt.md

---

Step 2: Create a Fresh Gemini Chat

Open a brand new Gemini conversation for this slug.

Never reuse an existing conversation.

---

Step 3: Configure Gemini

Before sending anything:

- Select the Pro model.
- Enable Extended thinking.

Verify both settings are actually enabled.

Because Gemini's UI sometimes ignores clicks:

- Take a screenshot or otherwise verify the UI.
- If the settings are incorrect, click again.
- Repeat until the UI confirms:
  - Pro model
  - Extended thinking enabled

Do not continue until this is verified.

---

Step 4: Paste the Prompt

The prompt file begins with an HTML comment header (`<!-- ... -->`) that contains
save/ingest instructions for YOU. Strip that header comment before pasting — it is
not part of the model prompt, and pasting it wastes context. Paste only the content
below the header (from the first `# Teaching voice` heading onward).

Do not inject text using JavaScript.

Never use:

- execCommand("insertText")
- DOM manipulation
- JavaScript text insertion

These methods silently truncate long prompts.

Instead:

1. Copy the prompt body (with the header comment stripped) to the clipboard. Strip
   everything up to and including the header's closing `-->` line, which is robust
   to header length:

   sed '1,/-->/d' curriculum/_build/generate_content/web/examples/n5/<type>/<slug>.prompt.md | pbcopy

   (Verify the copied text starts with `# Teaching voice`.)

2. Focus the Gemini input.
3. Paste using a real keyboard shortcut:

   Cmd + V

---

Step 5: Verify Paste Integrity

Before sending:

- Compare the pasted content length with the source prompt body.
- Confirm the prompt was pasted completely and starts with `# Teaching voice`.
- If truncated, clear the input and paste again.

Do not submit an incomplete prompt.

---

Step 6: Determine When the Response Has Finished

Do not infer completion from the tab title changing.

Do not poll the response text length and treat two stable-looking reads as completion.

Both are indirect signals that can be sampled mid-stream. A title can appear before
generation finishes, and a length check can falsely report completion if the polling
interval lands between token bursts.

This has previously caused mid-stream responses to be mistaken for short but complete
responses.

Instead, use the stop-generating button as the authoritative signal:

- While Gemini is generating, a square stop icon is shown in place of the mic/send button.
- Poll for the square stop button to disappear.
- Confirm that the mic/send button has reappeared.
- Only treat the response as finished once the stop button is gone.

Do not click "Copy code" or "Download code" until the stop button has disappeared.

As a secondary sanity check after the stop button is gone, verify that the extracted
content is valid JSON and that JSON parsing succeeds.

This catches edge cases where the button state and content state are momentarily out
of sync. However, the stop-button check is the primary completion signal, not
text-length polling.

---

Step 7: Extract the Response — Download, Rename, and Move

Gemini's code-block viewer is DOM-virtualized. Reading innerText or clicking "Copy
code" on a long response can silently return only a partial snippet, even though the
full response exists.

Do not rely on copy-to-clipboard or page-text extraction for the response content.

Instead:

1. Once the response has finished according to Step 6, click the "Download code"
   button on the JSON code block.

   This saves the full response as a file, such as:

   gemini-code-<timestamp>.json

   The file will normally be saved to the Downloads folder.

   Ask for explicit permission before the first download of the session.

2. Verify the downloaded file:
   - Confirm it parses as valid JSON.
   - Confirm it matches the output contract. It is the SAME contract for both
     content types (kanji and vocab): a single top-level `example_sentences` array
     of 2–4 objects, each with exactly these keys:
     - japanese
     - english
     - vocabulary_slugs

3. Move and rename the file into place:
   - Read the downloaded JSON.
   - Rewrite it as the required fenced ```json ... ``` reply file at:

   curriculum/_build/generate_content/web/examples/n5/<type>/<slug>.reply.md

4. Delete the original downloaded file from Downloads after it has been moved into
   place.

   Do not leave stray downloaded files behind.

Save Gemini's initial response without modifying its content.

If ingestion later fails, the repair subagent described in Step 8 may make targeted
changes to the reply file.

---

Step 8: Ingest and Repair

Run:

.venv/bin/python -m generate_content.generate_examples ingest --type <type> --level n5 --slug <slug> --model gemini-web

If ingestion succeeds:

The item is merged into the per-level sidecar:

- kanji → curriculum/kanji/examples/n5.json
- vocab → curriculum/vocabulary/examples/n5.json

Record the slug as successful and proceed to the next slug.

If ingestion fails:

The ingestion process rewrites:

curriculum/_build/generate_content/web/examples/n5/<type>/<slug>.prompt.md

with validation errors appended.

Do not return to Gemini.

Do not open another Gemini chat.

Do not regenerate the entire set of sentences.

Instead, use a subagent to repair the existing reply.

Repair Procedure

1. Launch a general-purpose subagent.
   - Prefer the latest available Opus model with high reasoning.
   - If an Opus model is unavailable, use the strongest suitable reasoning or coding model available.
   - Run the subagent in the foreground because ingestion must wait for the repair to finish.

2. Give the subagent these files:
   - curriculum/_build/generate_content/web/examples/n5/<type>/<slug>.prompt.md
   - curriculum/_build/generate_content/web/examples/n5/<type>/<slug>.reply.md

3. Give the subagent the following instructions:

   Read the validation errors appended to `<slug>.prompt.md`.

   Inspect the existing `<slug>.reply.md` and the complete output contract in the prompt.

   Edit `<slug>.reply.md` to resolve every reported ingestion error.

   Requirements:

   - Make the smallest changes necessary.
   - Preserve valid sentences wherever possible.
   - Do not rewrite every sentence unless the errors make that unavoidable.
   - Fix all reported errors, not only the first one.
   - Edit only `<slug>.reply.md`.
   - Do not edit `<slug>.prompt.md`.
   - Do not modify validators, ingestion code, curriculum source data, the allowed-vocab derivation, or the assembled sidecar.
   - Preserve the required reply-file format (a single fenced ```json block).
   - Preserve the exact output contract: one top-level `example_sentences` array whose elements each have exactly `japanese`, `english`, and `vocabulary_slugs`. This contract is the same for kanji and vocab.
   - Keep the array at 2–4 sentences.
   - Ensure the repaired content parses as valid JSON.
   - Every sentence must actually use the target: for vocab, the word's dictionary form (a natural conjugation counts — 食べました exemplifies 食べる); for kanji, the character must appear inside a taught target word listed in the prompt.
   - Every slug in a sentence's `vocabulary_slugs` must be in the prompt's allowed-vocabulary list; do not reference any word outside it.
   - Every content word in each Japanese sentence must be in-level per the prompt's allowed vocabulary (no out-of-level words the level-check will reject).
   - Keep every Japanese sentence fully annotatable by the tokenizer (avoid constructions that fail the furigana round-trip).
   - Keep all fields plain prose — no markdown, headings, lists, bold/italic, furigana brackets, or romaji. The pipeline adds furigana itself.
   - Keep each Japanese sentence and English translation within the length bounds implied by the gate errors.
   - Do not add commentary outside the required JSON block.
   - Do not set or add any review_status field.

4. Wait for the subagent to finish updating the reply file.

5. Run ingestion again:

.venv/bin/python -m generate_content.generate_examples ingest --type <type> --level n5 --slug <slug> --model gemini-web

6. If ingestion fails again:
   - Read the newly appended validation errors from the rewritten prompt file.
   - Launch a new repair subagent using the updated prompt and reply files.
   - Repeat the targeted repair procedure.
   - Run ingestion again.
   - Do not return to Gemini.

Retry Limit

Allow at most three ingestion attempts per slug, including the initial ingestion attempt:

- Attempt 1: Original Gemini reply
- Attempt 2: First subagent repair
- Attempt 3: Second subagent repair

If the third ingestion attempt fails:

- Stop retrying the slug.
- Record it as failed or skipped.
- Preserve the latest validation errors for the final report.
- Proceed to the next slug.

Do not waste additional Gemini turns.

---

Ordering Note

Each run is a single content type and covers only its auto-selected BATCH_LIMIT
slugs, so finishing a whole level takes several runs. Do vocab and kanji as separate
runs, and do N5 fully before N4. On the first run of a fresh type, read the assembled
output before launching more runs — the batch size is already pilot-sized, so one run
doubles as the pilot.

---

Final Build

After every slug has been successfully ingested or skipped, run the project's normal
generation pipeline from the repository root.

Check the current invocation under:

curriculum/_build/generate_content/

Then run:

generate.py --level n5

Followed by:

npm run validate-schema

And:

npm run compile-curriculum

`generate.py` inlines the example sidecars into the shipped kanji/vocab JSON and adds
furigana with the tokenizer. Use the current project-specific `generate.py`
invocation and flags found under `curriculum/_build/`. Do not guess if the documented
invocation has changed.

---

Final Report

Provide a summary containing:

- The content type and the exact auto-selected slug set for this run (with the count vs. BATCH_LIMIT)
- ✅ Successfully generated slugs
- ⚠️ Skipped slugs
- ❌ Failed slugs
- Roughly how many slugs of this type remain not-yet-done for the level (re-run Step 1a to get the count), so it's clear whether another run is needed
- The number of subagent repair attempts used for each affected slug
- Validation or ingestion issues encountered
- Validation errors remaining after the final allowed attempt
- Final build, schema-validation, and compilation results
- Any manual follow-up required

Do not modify or set review_status to reviewed.

That is a manual human-review step (Phase 5) that automation must not perform.

---

Important Constraints

- Gemini is used only to produce the first reply for each slug.
- Never return to Gemini after an ingestion failure.
- Repair failed replies using an Opus-preferred subagent.
- Always rerun ingestion after a subagent updates a reply.
- Use a fresh repair subagent for each failed repair attempt.
- Do not bypass or weaken validation.
- Do not modify validator or ingestion code, the allowed-vocab derivation, or curriculum source data to make invalid content pass.
- Tatoeba sentences shown in a prompt are style anchors only — never copy or adapt them into a generated sentence.
- Do not manually mark generated examples as reviewed.

---

Notes on differences from the mnemonic automation prompt

- This flow is parameterized by `--type` (kanji or vocab), NOT kanji/radical.
  Radicals do not get example sentences.
- The output contract is the same for both types: a single `example_sentences`
  array of `japanese` / `english` / `vocabulary_slugs` objects (Step 7, Step 8) —
  there are no per-type key differences as there are for mnemonics.
- The committed artifact is a per-level, keyed-by-slug sidecar
  (`curriculum/<kanji|vocabulary>/examples/n5.json`) that `ingest` merges into —
  not a per-slug file as with grammar lessons. Inspect the sidecar entry.
- Step 4 explicitly strips the prompt file's HTML header comment before pasting.

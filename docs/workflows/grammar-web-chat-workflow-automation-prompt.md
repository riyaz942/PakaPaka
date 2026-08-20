Task: Generate Grammar Lessons via Gemini Web



Use the existing logged-in Gemini session in my Chrome browser to generate grammar lessons for this level.

This run **auto-selects remaining unwritten slugs** unless you fill "Slugs for this run" below with a real comma list. Do not invent slugs — they are existing grammar-point ids.

Level (one JLPT level per run; change to `n4`, `n3`, … when ready):

<level = n5>

Slugs for this run (optional override; leave the placeholder to auto-select):

<slug, slug>

If that is still the placeholder `<slug, slug>` (or empty), list remaining unwritten slugs from `curriculum/_build` and use the next batch in curriculum order (~10 is a practical sitting):

.venv/bin/python - <<'PY'
import os, sys; sys.path.insert(0, '.')
from generate_content import context
level = '<level>'
done = {f[:-3] for f in os.listdir(f'../grammar/lessons/{level}')} if os.path.isdir(f'../grammar/lessons/{level}') else set()
todo = [g['slug'] for g in context.load_grammar(level) if g['slug'] not in done]
print(f'{len(todo)} {level} points left:')
print(','.join(todo[:10]))
PY

If it prints 0 slugs, this level is already fully written — stop and report that. Otherwise treat the printed comma list as this run's slug set. Pass it as one string with **no spaces after the commas** to Step 1.



Browser Requirements



- Use Chrome, not Edge.

- If multiple browsers are connected:

  a. List all connected browsers.

  b. Determine which browser has an active Gemini session.

  c. Confirm you will use the logged-in Chrome instance before continuing.



---



Workflow



Process one slug at a time. Every slug must use a fresh Gemini chat with no shared conversation context.



Step 1: Generate Prompt



From the following directory:



curriculum/_build



Run, using the comma list from the listing above (one string, no spaces after commas):



.venv/bin/python -m generate_content.generate_grammar_lessons webprompts --level <level> --slugs <slug>



Generating multiple prompts at once is acceptable, but each slug must still use its own Gemini chat.



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



Do not inject text using JavaScript.



Never use:



- execCommand("insertText")

- DOM manipulation

- JavaScript text insertion



These methods silently truncate long prompts.



Instead:



1. Copy the prompt body using:



pbcopy < <path-to-prompt-body>



2. Focus the Gemini input.

3. Paste using a real keyboard shortcut:



Cmd + V



---



Step 5: Verify Paste Integrity



Before sending:



- Compare the pasted content length with the source prompt.

- Confirm the prompt was pasted completely.

- If truncated, clear the input and paste again.



Do not submit an incomplete prompt.



---



Step 6: Determine When the Response Has Finished



Do not infer completion from the tab title changing.



Do not poll the response text length and treat two stable-looking reads as completion.



Both are indirect signals that can be sampled mid-stream. A title can appear before generation finishes, and a length check can falsely report completion if the polling interval lands between token bursts.



This has previously caused mid-stream responses to be mistaken for short but complete responses.



Instead, use the stop-generating button as the authoritative signal:



- While Gemini is generating, a square stop icon is shown in place of the mic/send button.

- Poll for the square stop button to disappear.

- Confirm that the mic/send button has reappeared.

- Only treat the response as finished once the stop button is gone.



Do not click "Copy code" or "Download code" until the stop button has disappeared.



As a secondary sanity check after the stop button is gone, verify that the extracted content is valid JSON and that JSON parsing succeeds.



This catches edge cases where the button state and content state are momentarily out of sync. However, the stop-button check is the primary completion signal, not text-length polling.



---



Step 7: Extract the Response — Download, Rename, and Move



Gemini's code-block viewer is DOM-virtualized. Reading innerText or clicking "Copy code" on a long response can silently return only a partial snippet, even though the full response exists.



Do not rely on copy-to-clipboard or page-text extraction for the response content.



Instead:



1. Once the response has finished according to Step 6, click the "Download code" button on the JSON code block.



   This saves the full response as a file, such as:



   gemini-code-<timestamp>.json



   The file will normally be saved to the Downloads folder.



   Ask for explicit permission before the first download of the session.



2. Verify the downloaded file:

   - Confirm it parses as valid JSON.

   - Confirm it contains all expected keys:

     - lesson_markdown

     - example_sentences

     - caution_notes

     - related_grammar_slugs

     - cloze_variants



3. Move and rename the file into place:

   - Read the downloaded JSON.

   - Rewrite it as the required fenced ```json ... ``` reply file at:



curriculum/_build/generate_content/web/<level>/<slug>.reply.md



4. Delete the original downloaded file from Downloads after it has been moved into place.



   Do not leave stray downloaded files behind.



Save Gemini's initial response without modifying its content.



If ingestion later fails, the repair subagent described in Step 8 may make targeted changes to the reply file.



---



Step 8: Ingest and Repair



Run:



.venv/bin/python -m generate_content.generate_grammar_lessons ingest --model gemini-web --slug <slug> --level <level>



If ingestion succeeds:



The lesson should be assembled at:



curriculum/grammar/lessons/<level>/<slug>.md



Record the slug as successful and proceed to the next slug.



If ingestion fails:



The ingestion process rewrites:



curriculum/_build/generate_content/web/<level>/<slug>.prompt.md



with validation errors appended.



Do not return to Gemini.



Do not open another Gemini chat.



Do not regenerate the entire lesson.



Instead, use a subagent to repair the existing reply.



Repair Procedure



1. Launch a general-purpose subagent.

   - Prefer the latest available Opus model with high reasoning.

   - If an Opus model is unavailable, use the strongest suitable reasoning or coding model available.

   - Run the subagent in the foreground because ingestion must wait for the repair to finish.



2. Give the subagent these files:

   - curriculum/_build/generate_content/web/<level>/<slug>.prompt.md

   - curriculum/_build/generate_content/web/<level>/<slug>.reply.md



3. Give the subagent the following instructions:



   Read the validation errors appended to `<slug>.prompt.md`.



   Inspect the existing `<slug>.reply.md` and the complete output contract in the prompt.



   Edit `<slug>.reply.md` to resolve every reported ingestion error.



   Requirements:



   - Make the smallest changes necessary.

   - Preserve valid lesson content wherever possible.

   - Do not rewrite the entire lesson unless the errors make that unavoidable.

   - Fix all reported errors, not only the first one.

   - Edit only `<slug>.reply.md`.

   - Do not edit `<slug>.prompt.md`.

   - Do not modify validators, ingestion code, curriculum source data, or the assembled lesson.

   - Preserve the required reply-file format.

   - Preserve the exact required JSON keys.

   - Ensure the repaired content parses as valid JSON.

   - Ensure `lesson_markdown` and `example_sentences` remain consistent.

   - Ensure every Japanese example appearing in the lesson is represented correctly in `example_sentences`.

   - Ensure vocabulary slugs are valid and accurately describe the words used.

   - Ensure related grammar slugs are valid.

   - Ensure cloze variants use the target grammar correctly.

   - Ensure all Japanese and vocabulary satisfy the level and prompt constraints.

   - Do not add commentary outside the required JSON block.

   - Do not set `review_status` to `reviewed`.



4. Wait for the subagent to finish updating the reply file.



5. Run ingestion again:



.venv/bin/python -m generate_content.generate_grammar_lessons ingest --model gemini-web --slug <slug> --level <level>



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



Final Build



After every slug has been successfully ingested or skipped, run the project's normal generation pipeline from the repository root.



Check the current invocation under:



curriculum/_build/generate_content/



Then run:



generate.py



Followed by:



npm run validate-schema



And:



npm run compile-curriculum



Use the current project-specific `generate.py` invocation and flags found under `curriculum/_build/generate_content/`. Do not guess if the documented invocation has changed.



---



Final Report



Provide a summary containing:



- ✅ Successfully generated slugs

- ⚠️ Skipped slugs

- ❌ Failed slugs

- The number of subagent repair attempts used for each affected slug

- Validation or ingestion issues encountered

- Validation errors remaining after the final allowed attempt

- Final build, schema-validation, and compilation results

- Any manual follow-up required



Do not modify or set `review_status` to `reviewed`.



That is a manual human-review step.



---



Important Constraints



- Gemini is used only to produce the first reply for each slug.

- Never return to Gemini after an ingestion failure.

- Repair failed replies using an Opus-preferred subagent.

- Always rerun ingestion after a subagent updates a reply.

- Use a fresh repair subagent for each failed repair attempt.

- Do not bypass or weaken validation.

- Do not modify validator or ingestion code to make invalid content pass.

- Do not manually mark generated lessons as reviewed.



---



Changes from the Original Prompt



- Step 6 adds the stop-button completion check as the authoritative signal before extracting a response. It replaces reliance on title changes or text-length polling.

- Step 7 uses Download → verify → move/rename → cleanup instead of clipboard or page-text extraction, which can be truncated by Gemini's virtualized code viewer.

- Step 8 uses an Opus-preferred repair subagent after ingestion failures. Gemini is used only for the initial response; failed replies are repaired locally and re-ingested instead of generating another Gemini response.
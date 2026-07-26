Task: Generate N5 Radical/Kanji/Vocabulary Mnemonics via Gemini Web



Use the existing logged-in Gemini session in my Chrome browser to generate Phase
2b/2d mnemonic prose for the following items. This run is for ONE content type at a
time.



Content type (one of `radical`, `kanji` or `vocab`):



<type>



Slugs (all of the type above):



<slug, slug>



This is the browser-driven, no-API equivalent of the Message Batches driver in
`curriculum/_build/generate_content/generate_mnemonics.py`. Only the "call the
model" step moves to the browser; the context builder, the cast injection, and the
mechanical gate are identical to the API path. See
`docs/workflows/kanji-radical-mnemonic-web-chat-workflow.md`.



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



Step 1: Generate Prompt



From the following directory:



curriculum/_build



Run:



.venv/bin/python -m generate_content.generate_mnemonics webprompts --type <type> --level n5 --slugs <slug>



Generating multiple prompts at once is acceptable, but each slug must still use its
own Gemini chat. The prompt file is written to:



curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.prompt.md



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



   sed '1,/-->/d' curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.prompt.md | pbcopy



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

   - Confirm it contains all expected keys for this content type:

     - For <type> = kanji:

       - meaning_mnemonic

       - reading_mnemonic

       - description (optional — present only when the item has look-alikes to
         contrast or a nuance the mnemonics cannot carry)

     - For <type> = radical:

       - description

     - For <type> = vocab:

       - meaning_mnemonic

       - reading_mnemonic

       - description (optional, same rule as kanji)



3. Move and rename the file into place:

   - Read the downloaded JSON.

   - Rewrite it as the required fenced ```json ... ``` reply file at:



curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.reply.md



4. Delete the original downloaded file from Downloads after it has been moved into
   place.



   Do not leave stray downloaded files behind.



Save Gemini's initial response without modifying its content.



If ingestion later fails, the repair subagent described in Step 8 may make targeted
changes to the reply file.



---



Step 8: Ingest and Repair



Run:



.venv/bin/python -m generate_content.generate_mnemonics ingest --type <type> --level n5 --slug <slug> --model gemini-web



If ingestion succeeds:



The item is merged into the per-level sidecar:



- radical → curriculum/radicals/mnemonics/n5.json

- kanji   → curriculum/kanji/mnemonics/n5.json

- vocab   → curriculum/vocabulary/mnemonics/n5.json



Record the slug as successful and proceed to the next slug.



If ingestion fails:



The ingestion process rewrites:



curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.prompt.md



with validation errors appended.



Do not return to Gemini.



Do not open another Gemini chat.



Do not regenerate the entire mnemonic.



Instead, use a subagent to repair the existing reply.



Repair Procedure



1. Launch a general-purpose subagent.

   - Prefer the latest available Opus model with high reasoning.

   - If an Opus model is unavailable, use the strongest suitable reasoning or coding model available.

   - Run the subagent in the foreground because ingestion must wait for the repair to finish.



2. Give the subagent these files:

   - curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.prompt.md

   - curriculum/_build/generate_content/web/mnemonics/n5/<type>/<slug>.reply.md



3. Give the subagent the following instructions:



   Read the validation errors appended to `<slug>.prompt.md`.



   Inspect the existing `<slug>.reply.md` and the complete output contract in the prompt.



   Edit `<slug>.reply.md` to resolve every reported ingestion error.



   Requirements:



   - Make the smallest changes necessary.

   - Preserve valid mnemonic content wherever possible.

   - Do not rewrite the entire mnemonic unless the errors make that unavoidable.

   - Fix all reported errors, not only the first one.

   - Edit only `<slug>.reply.md`.

   - Do not edit `<slug>.prompt.md`.

   - Do not modify validators, ingestion code, curriculum source data, the cast bible, or the assembled sidecar.

   - Preserve the required reply-file format (a single fenced ```json block).

   - Preserve the exact required JSON keys for the content type (kanji and vocab: meaning_mnemonic and reading_mnemonic, plus description only when the item needs one; radical: description). Do not add a description the earlier draft omitted unless an error asks for one.

   - Ensure the repaired content parses as valid JSON.

   - For kanji: the meaning_mnemonic must reference every taught component listed in the prompt's "Taught decomposition" section, and must not name any component that is not listed there.

   - For kanji: the reading_mnemonic must contain the target reading kana shown in the prompt, verbatim, inside a `<reading>` tag.

   - Highlight tags (kanji and vocab): each taught component's meaning is wrapped where the story uses it — `<radical>` in a kanji meaning mnemonic, `<kanji>` in a vocab one — and the reading kana plus the English phonetic hook are wrapped in `<reading>` in the reading mnemonic. One tag per field, every tag closed, none nested, and none in a description or a radical.

   - For vocab: the meaning_mnemonic must reference every kanji listed in the prompt's "The kanji in this word" section; the reading_mnemonic must contain the word's reading verbatim and must follow the prompt's "The reading" section — a one-line derivation note when it says the reading is regular or kana-only, a full story when it says otherwise.

   - For radical and kanji: when a description is present it must name every look-alike listed in the prompt and no other Japanese character; a kanji whose prompt lists look-alikes must have one.

   - Keep all fields plain prose apart from the highlight tags — no markdown, headings, lists, bold/italic, furigana brackets, or romaji. Aim for roughly 350–700 characters per mnemonic.

   - Keep each field within the length bounds implied by the gate errors.

   - Do not add commentary outside the required JSON block.

   - Do not set or add any review_status field.



4. Wait for the subagent to finish updating the reply file.



5. Run ingestion again:



.venv/bin/python -m generate_content.generate_mnemonics ingest --type <type> --level n5 --slug <slug> --model gemini-web



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



Types chain: radicals first, then kanji, then vocab. A kanji story continues its
radicals' established descriptions and a vocab story hooks into its kanji's meaning
mnemonics, so each layer should be settled before the layer that feeds on it.
(Each run is one type; sequence the runs accordingly.)



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



Use the current project-specific `generate.py` invocation and flags found under
`curriculum/_build/`. Do not guess if the documented invocation has changed.



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



Do not modify or set review_status to reviewed.



That is a manual human-review step (Phase 5), and it includes a cross-batch
cast-coherence pass that automation must not perform.



---



Important Constraints



- Gemini is used only to produce the first reply for each slug.

- Never return to Gemini after an ingestion failure.

- Repair failed replies using an Opus-preferred subagent.

- Always rerun ingestion after a subagent updates a reply.

- Use a fresh repair subagent for each failed repair attempt.

- Do not bypass or weaken validation.

- Do not modify validator or ingestion code, or the cast bible, to make invalid content pass.

- Do not manually mark generated mnemonics as reviewed.



---



Notes on differences from the grammar automation prompt



- This flow is parameterized by `--type` (radical, kanji or vocab); the required
  JSON keys and the repair requirements differ per type (Step 7, Step 8).

- The committed artifact is a per-level, keyed-by-slug sidecar
  (`curriculum/<radicals|kanji|vocabulary>/mnemonics/n5.json`) that `ingest` merges
  into — not
  a per-slug file as with grammar lessons. There is no separate assembled file to
  inspect per item; inspect the sidecar entry.

- Step 4 explicitly strips the prompt file's HTML header comment before pasting.

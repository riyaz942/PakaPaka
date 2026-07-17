# Mnemonic cast bible — v1

Recurring characters and settings for kanji/radical mnemonics (Phase 2b) and any
mnemonic-flavored asides in grammar lessons. Locked before the grammar pilot per
docs/content/content-pipeline-plan.md step 3: batch generation calls are independent, so
the generator script injects the relevant entries from this file into each item's
prompt — a character invented ad hoc in one batch will not exist in the next.

## Rules

1. **One reading, one character, forever.** A kanji reading is always personified
   by the same cast member below. Never invent a new character for a reading that
   already has one; extend this file first, then generate.
2. **Characters are vivid and specific**, with one dominant trait that does the
   mnemonic work. Traits never change between items.
3. **Settings are reused the same way** — a mnemonic set "at the shrine" always
   means Grandma Kane's shrine below.
4. **Grammar lessons may reference the cast only in passing** (e.g. an example
   scenario at Koichi's konbini); they must not depend on the reader knowing a
   mnemonic story.
5. Reviewers run a cross-batch coherence pass: drift from this sheet is a defect,
   not a creative choice.

## Core cast (readings → characters)

| Reading | Character | Dominant trait / image |
|---|---|---|
| こう | **Koichi**, the konbini king | runs a 24-hour konbini, obsessed with efficiency, always restocking |
| しょう | **Sho**, the tiny stage magician | everything about him is small but showy; white gloves, doves |
| せい | **Sei**, the star student | neat uniform, hand always up first, slightly smug |
| か | **Kaa**, the fire-breathing crow | perches on power lines, breathes little puffs of flame |
| き | **Kiki**, the tree spirit | lives inside old trees, giggles when the wind blows |
| けん | **Ken**, the sword-collecting dog | a shiba inu who guards a wall of antique swords |
| じん・にん | **Jin**, the friendly giant | gentle, enormous, ducks through every doorway |
| ちゅう | **Chuu**, the loyal mouse | tiny samurai topknot, absurdly devoted |
| だい | **Dai**, the giant baby | the size of a truck, cries earthquakes |
| と | **Toto**, the door-to-door turtle | sells doors, carries samples on his shell |
| はん | **Han**, the half-and-half chef | everything he cooks is split exactly in half |
| ぶん・もん | **Mon-Bun**, the scholarly rabbit twins | inseparable, argue about books constantly |

## Settings

| Setting | Fixed details |
|---|---|
| **Koichi's konbini** | fluorescent-bright, onigiri shelf by the door, beeping till |
| **Grandma Kane's shrine** | mossy steps, one enormous bell, cats everywhere |
| **the riverbank** | where anything involving water, washing, or crossing happens |
| **the mountain trail** | steep, one vending machine improbably at the top |
| **the school** | Sei's school; sports field, echoing hallways |

## Extending the cast

Add rows here (in a PR that bumps `prompt_version`) before generating any item
that needs a new reading-character. Choose names a learner can say aloud and
traits that are drawable — Tier 2 radical art (Phase 3) is prompted from these
images.

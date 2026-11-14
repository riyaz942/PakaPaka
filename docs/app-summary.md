# PakaPaka — Super Summary

Short summary for competitor research. Written from the code and the seed `curriculum.db`, not from
other docs. Snapshot date: 2026-10-21. For the full screen-by-screen view, see
[app-overview.md](./app-overview.md).

## What it is

PakaPaka is a free, open-source Japanese learning app for iOS and Android (Expo / React Native).
It has no account and no subscription. All progress stays on the phone. Only the AI chat needs the
internet.

**In short:** WaniKani + Bunpro + graded readers + an AI conversation partner, in one app. It works
offline and is free.

## Main features

1. **Lessons in a fixed order.** Radical → kanji → vocabulary, from a dependency graph. Grammar has
   its own lessons. Each item has mnemonics, readings and example sentences.
2. **SRS reviews with FSRS.** One mixed review queue for all item types. A weak item gets more
   priority (70% FSRS + 30% error rate). You type the answer. Romaji changes to kana as you type.
   A typo is accepted and does not count as a miss.
3. **Two cards for each kanji.** One card asks the meaning, one asks the on'yomi. The worse result
   sets the SRS grade. You learn kun'yomi through vocabulary.
4. **Grammar reviews.** "Read" cards ask you to understand a sentence. "Build" cards ask you to write
   the sentence (kanji and kana can mix). If you use a different grammar point that is also correct,
   the app tells you.
5. **Reading passages.** A passage unlocks when you know about 90% of its words. Each passage has
   comprehension questions.
6. **AI chat (Talk tab).** You bring your own key (OpenAI-compatible or Anthropic). The AI uses only
   words from your curriculum and shows furigana. It marks unknown words, but it does not add them
   to your SRS. Voice works on the phone: Whisper-small (speech-to-text) and Supertonic
   (text-to-speech), both on-device.
7. **Start where you are.** A placement test checks each level and item type. You can also import
   progress from WaniKani, Bunpro or Anki (`.apkg`). Their SRS stages convert to FSRS.
8. **No guilt.** The daily goal ring can go above 100%. There is no streak on Home. Reviews have no
   cap. There is a vacation mode, a "welcome back" flow and an "at-risk items" list.
9. **Other features.** Browse/search with filters, a compare view for kanji that look similar, your
   own synonyms, furigana that hides when you know a word, backup and restore, and notifications.

## Content (seed database)

| Level | Status |
| --- | --- |
| **N5 + N4** | Complete: 254 kanji, 1,247 words, 161 grammar points, 60 passages, about 5,300 example sentences |
| **N3 to N1** | Items are present (1,675 kanji, 8,500 words), but most mnemonics are not written yet. There is no grammar and there are no passages for these levels yet. |

There is also a local web tool, "Curriculum Studio" (`web/`), to edit the content.

## What may be different

- Kanji, vocabulary, grammar, reading and AI conversation are in **one app**. Most apps do only one
  or two of these.
- It is **free, open source and offline**, with no account.
- **The AI chat stays in the curriculum.** It uses your known words and shows furigana in brackets.
- **Speech on the device**, not in the cloud.
- **Passages unlock by coverage** (about 90% known words), not by level.
- **Weakness biasing**, and also groups of confusions (for example は vs が, て vs た).
- **It imports from WaniKani, Bunpro and Anki** and keeps your SRS state.

## Search terms for competitor research

- "WaniKani alternative free offline"
- "Bunpro + WaniKani combined app"
- "FSRS Japanese kanji app"
- "Japanese app AI conversation bring your own API key"
- "graded reader unlock by known vocabulary"

Apps to compare: **WaniKani, Bunpro, Renshuu, Migaku, Satori Reader, LingQ, Kanji Study, Jpdb.io,
Marumori, Torii, Anki + KKLC decks.** Renshuu and Marumori are the closest "all-in-one" apps. Migaku
and LingQ are the closest for "known-word coverage".

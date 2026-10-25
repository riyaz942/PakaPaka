# NihongoCore — Marketing Page Brief

Brief for designing the new marketing landing page. Written from the codebase on 2026-10-25.
It replaces the content of the old page (`website/index.html`).

---

## 1. The core concept (put this at the center of the page)

**Everything you learn unlocks the next thing, and every step uses only what you already know.**

NihongoCore is one connected path through Japanese:

```
Radicals → Kanji → Vocabulary → Grammar → Reading → Conversation
```

- A kanji unlocks only after you learn its radicals.
- A word unlocks only after you learn its kanji.
- A reading passage unlocks only when you know about 90% of its words.
- The AI conversation partner speaks using only words from your curriculum.

All of it goes through **one review queue** that learns where you make mistakes and shows you
those items first.

**In one line:** WaniKani + Bunpro + graded readers + an AI conversation partner, in one app.
Free, open source, and fully offline. No account.

---

## 2. Product facts

| | |
| --- | --- |
| Name | **NihongoCore** |
| What | Japanese learning app: kanji, vocabulary, grammar, reading and conversation |
| Platforms | iOS 17+ and Android 13+ |
| Price | Free. No subscription, no ads, no paywall |
| Account | None. All progress stays on the phone |
| Internet | Not needed. Only the optional AI chat uses the network |
| License | Code: MIT. Content: CC BY-SA 4.0 |
| Source | https://github.com/riyaz942/nihongo-core |
| Mascot | **Alpi the alpaca** (cheers at the end of sessions; assets in `mobile/assets/images/mascot/`) |
| Brand mark | 刻 ("to carve") — old tagline: *"Carve Japanese into memory."* |

---

## 3. Current status (be honest on the page)

- **In active development.** Not in the App Store or Google Play yet. Today you can build it
  from source (GitHub).
- **N5 and N4 are complete:** mnemonics, example sentences, all grammar and reading passages.
- **N3, N2 and N1 are a first version:** kanji, radicals and words with readings, meanings and
  furigana. Their mnemonics, examples, grammar and passages are not written yet.
- Good page call to action: **"Star on GitHub"** / **"Follow the build"** / **"Get notified at launch."**
  Not "Download now."

### Content numbers

| | Count |
| --- | --- |
| Kanji | 2,000 |
| Vocabulary | 9,747 |
| Radicals | 817 |
| Grammar points | 161 (N5 + N4) |
| Reading passages | 60 (30 N5 + 30 N4) |
| Example sentences | about 5,300 (N5 + N4) |

Fully finished today (N5 + N4): 254 kanji, 1,247 words, 161 grammar points, 60 passages.

---

## 4. The problem it solves

Most learners use three or more apps: one for kanji (WaniKani), one for grammar (Bunpro), a
flashcard deck for everything else (Anki), and maybe a reader and a chat app too. Each one has
its own subscription. None of them know what you learned in the others.

NihongoCore puts all of it into one graph and one review queue. You can also import your
progress from WaniKani, Bunpro and Anki, so you do not start again from zero.

---

## 5. Features (for feature sections)

### Learn in the right order
- Lessons in a fixed order from a dependency graph: radical → kanji → vocabulary.
- Grammar has its own lessons (Intro · Usage · Examples), each with a story mnemonic.
- Each item has mnemonics, readings and example sentences.
- A short "How words change" primer before ます, and a conjugation table (8 forms) on every
  verb and adjective page.
- Nothing saves until the last card, so stopping halfway costs nothing.
- "Quiz me now" at the end of a lesson starts a review of the new items at once.

### Reviews that find your weak points
- Scheduling with **FSRS** (a modern spaced-repetition algorithm), blended with a weakness
  score from your real mistakes: `priority = 0.7 × FSRS + 0.3 × weakness`.
- One mixed queue for every item type.
- Five stages: **Apprentice → Guru → Master → Enlightened → Burned**.
- It also finds groups of confusions (for example は vs が, て vs た).

### You type every answer
- No multiple choice. You type the meaning or the reading.
- Romaji turns into kana as you type.
- A typo is accepted and does not count as a miss. Wrong-script hints help you.
- If your answer belongs to a *different* item, a compare screen shows the difference.
- **Two cards per kanji:** meaning and on'yomi. You learn kun'yomi through vocabulary.
- **Two cards per grammar point:**
  - **Read** — see a Japanese sentence and type what the grammar means.
  - **Build** — see an English sentence and type the full sentence in Japanese.
- Optional **Lightning Mode**: go to the next card as soon as you answer correctly.

### Read real passages
- 60 graded reading passages with comprehension questions.
- A passage unlocks by **what you know** (about 90% known words), not by level.
- Furigana hides by itself for words you know. You can change it for each word.
- Tap a word to open its page.

### Talk (AI conversation)
- Practice conversation with an AI partner, built around your grammar points.
- **Bring your own key** (OpenAI-compatible or Anthropic). Your key stays in secure storage.
- The AI stays inside your curriculum and shows furigana.
- Unknown words are marked, but they are not added to your reviews.
- **Voice on the device:** speech-to-text and text-to-speech run on the phone, not in the cloud.
- Chats stay on your phone.

### Start where you are
- **New to Japanese:** a short day-one deck of guide cards.
- **I know some:** pick your level and take a one-minute placement check.
- **Import:** WaniKani (API), Bunpro, Anki (`.apkg`), or a NihongoCore backup.
  SRS stages convert to FSRS.
- **Shadow mode:** use NihongoCore next to your current tools and compare before you change.

### No guilt
- The daily goal ring can go past 100%.
- No streak on the Home screen. Reviews have no cap.
- **Vacation mode** stops reviews from piling up while you are away.
- A "welcome back" flow after a break, and an "at-risk items" list.

### Yours
- Browse and search everything with filters (type, level, status).
- Compare view for kanji that look the same.
- Add your own mnemonics and synonyms.
- Light / Dark / Auto theme, reduce motion.
- Customize the Home screen (reorder and hide sections).
- Backup and restore to a file. Daily reminders.

---

## 6. What makes it different (comparison section)

1. **All in one app:** kanji, vocabulary, grammar, reading and conversation. Most apps do one or two.
2. **Free, open source, offline, no account.**
3. **Everything uses what you already know:** passages unlock by known words, and the AI talks
   at your level.
4. **Weakness-aware reviews**, not only time-based.
5. **On-device voice**, not cloud speech.
6. **Imports from WaniKani, Bunpro and Anki** and keeps your SRS progress.

Closest apps to compare against: WaniKani, Bunpro, Renshuu, Marumori, Migaku, LingQ,
Satori Reader, Jpdb, Torii, Anki.

---

## 7. Suggested page structure

1. **Hero** — Headline about the core concept. Sub-line: "Kanji, vocabulary, grammar, reading
   and conversation in one app. Free, open source, fully offline." Badges: *Free · Open source ·
   Offline · iOS & Android*. CTA: "Star on GitHub" + "See how it works". A phone mockup of a
   review card (for example 時間 → じかん).
2. **The problem** — three apps, three bills, no connection → one app, $0.
3. **The path** (core concept visual) — Radicals → Kanji → Vocabulary → Grammar → Reading →
   Talk, shown as a chain where each step unlocks the next. Use the content colors (section 8).
4. **Reviews that find your weak points** — the priority formula + the five SRS stages.
5. **Type every answer** — romaji → kana as you type; Read and Build grammar cards.
6. **Read** — passage unlocks at 90% known words; furigana fades as you learn.
7. **Talk** — AI chat at your level, bring your own key, on-device voice.
8. **Start where you are** — placement check and import from WaniKani / Bunpro / Anki.
9. **No guilt** — goal ring past 100%, no streak, vacation mode. Alpi the alpaca here.
10. **Principles** — Offline · Open source · No subscriptions · Your data stays on your phone.
11. **Status + final CTA** — "In development. N5 and N4 are complete. Follow the build on GitHub."
12. **Footer** — GitHub, license, "Made with 愛 for learners".

### Headline ideas
- "Learn Japanese from what you already know."
- "One path. One queue. All of Japanese."
- "Carve Japanese into memory." (kept from the old site, with the 刻 mark)
- "Kanji, grammar, reading and conversation. One app. Free forever."

---

## 8. Design direction (match the app)

The page should look like the app (Design System v2): warm, calm, paper-like, not loud.

### Colors

| Token | Light | Dark |
| --- | --- | --- |
| Background | `#F7F5F2` (warm paper) | `#1B1917` |
| Surface | `#FFFFFF` | `#24211E` |
| Border | `#E7E2DB` | `#3A362F` |
| Text primary | `#23201C` | `#F6F3EE` |
| Text secondary | `#46423B` | `#D8D3CA` |
| Text muted | `#7C766C` | `#A29C90` |
| **Brand (jade green)** | `#159E77` (fill `#0E8163`, text `#0C654E`) | `#159E77` (text `#66CBAB`) |

**Content colors** (one color per item type — use them in the "path" visual):

| Type | Color |
| --- | --- |
| Radical | `#2F84D0` blue |
| Kanji | `#E14D86` pink |
| Vocabulary | `#8B5AD4` purple |
| Grammar | `#BA8125` amber |
| Reading passage | `#5C6B99` slate |

**SRS stage colors:** Apprentice `#E14D86` · Guru `#8B5AD4` · Master `#2F84D0` ·
Enlightened `#1698B8` · Burned `#57534B`.

### Fonts
- **Plus Jakarta Sans** — all interface and body text.
- **Zen Kaku Gothic New** (bold) — large hero Japanese characters (刻, 漢, 語 …).
- **Noto Sans JP** — readings, furigana, Japanese sentences.

### Feel
- Large single kanji as visual anchors, with furigana above Japanese text.
- Soft cards, rounded corners, lots of space.
- Must work in light and dark mode. Meet WCAG AA contrast.
- Real screenshots do not exist yet — use phone mockups of: Home (goal ring), a Review card,
  Browse, a Talk chat, and a reading passage.

---

## 9. Changes from the old page

The old page is out of date. The new page must:

- **Add the Talk tab** (AI conversation, bring your own key, on-device voice). The old page does
  not mention it.
- **Add placement check + shadow mode + backup/restore.**
- **Add the "No guilt" design** (no streaks, goal ring past 100%, vacation mode).
- **Add the two-card kanji** and the Read + Build grammar cards.
- **Add the conjugation tables** and the passage comprehension questions.
- **Fix the numbers:** say "2,000 kanji · 9,700+ words" only with the note that N5 + N4 are
  complete and N3–N1 are a first version.
- **Make the status clear:** not in the stores yet.

---

## 10. Claims to avoid

- Do not say "Download now" or show store badges as live — the app is not in the stores yet.
- Do not say "complete N5 to N1 curriculum". Only N5 and N4 are complete.
- Do not say the AI is free — the user pays their own AI provider through their key.
- Do not say "never forget" or show streaks — streaks are removed on purpose.
- Do not say grammar is available past N4.
- Do not imply the app is slower or limited offline. Only Talk needs the internet.
- Check competitor prices before you show them (the old page used WaniKani $299 lifetime,
  Bunpro $150 lifetime, Anki $25 on iOS).

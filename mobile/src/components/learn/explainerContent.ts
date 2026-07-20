/**
 * App-authored explainer copy for section headings (FR73).
 *
 * Deliberately *not* curriculum data: these explain app/JLPT vocabulary
 * ("what is a radical?"), not content rows, so they ship with the app and need
 * no curriculum schema. Every topic in the union has authored copy — there is
 * no "topic exists but has no content" state to degrade into.
 */
export type ExplainerTopic = 'onyomi-kunyomi' | 'radical' | 'burned' | 'transitive';

export type ExplainerContent = {
  title: string;
  paragraphs: string[];
};

export const EXPLAINER_CONTENT: Record<ExplainerTopic, ExplainerContent> = {
  'onyomi-kunyomi': {
    title: "On'yomi and kun'yomi",
    paragraphs: [
      'Most kanji have two kinds of reading. The on\'yomi is the reading Japanese borrowed from Chinese when the character was imported. The kun\'yomi is the reading of the native Japanese word that already meant the same thing.',
      "As a rough rule: on'yomi shows up when a kanji is part of a compound word made of several kanji, and kun'yomi shows up when the kanji stands alone or is followed by hiragana.",
      "You don't need to memorise which is which up front. Learn the readings that appear in the words you study, and the pattern will settle in on its own.",
    ],
  },
  radical: {
    title: 'Radicals',
    paragraphs: [
      'A radical is a building block that kanji are made of. Learning a handful of radicals first means a new kanji arrives as a small set of parts you already know rather than a brand-new shape.',
      'Radicals here also drive unlocking: a kanji becomes available once you have studied the radicals it is built from.',
    ],
  },
  burned: {
    title: 'Burned',
    paragraphs: [
      'Burned is the last SRS stage. An item reaches it after you have recalled it correctly across long gaps, at which point it stops coming back in reviews.',
      'Burned does not mean forgotten-proof. If a burned item shows up wrong later — in a reading, say — you can study it again.',
    ],
  },
  transitive: {
    title: 'Transitive and intransitive verbs',
    paragraphs: [
      'A transitive verb takes a direct object, marked with を: someone does the action to something. An intransitive verb does not — the thing acts, or the action simply happens.',
      'Japanese often has a transitive/intransitive pair built from the same kanji, so the pairing is worth noticing when you meet one half of it.',
    ],
  },
};

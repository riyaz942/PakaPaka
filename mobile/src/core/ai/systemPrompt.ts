import type { ConversationMode } from '@/core/ai/aiSession.types';
import { WRAP_UP_MARKER } from '@/core/ai/markers';

/**
 * System prompts for the conversation and summary calls.
 *
 * Pure string building — no I/O, no state. Two rules every prompt here carries:
 * replies are written in curriculum furigana bracket notation (FR91), and the
 * end of the scene is signalled with an in-band sentinel rather than a tool call
 * (FR97).
 */

export type GrammarPromptTopic = {
  primaryForm: string;
  meaning: string;
  structure?: string;
  exampleSentences?: string[];
};

export type ConversationPromptOptions = {
  mode: ConversationMode;
  /** Steer only — the app never truncates a conversation at this count (OA4). */
  turnBudget: number;
  grammarTopics?: GrammarPromptTopic[];
};

const FORMAT_RULES = [
  'Write every reply in Japanese, in curriculum furigana bracket notation: put each',
  'kanji run immediately followed by its kana reading in square brackets, for example',
  '私[わたし]は学生[がくせい]です。Annotate every kanji run this way. Never put',
  'anything but kana inside square brackets.',
].join(' ');

const CORRECTION_RULES = [
  'Do not correct the learner mid-conversation. Do not grade, score, or comment on',
  'their mistakes while the scene is running — stay in the conversation. Mistakes are',
  'collected and explained only after the session ends.',
].join(' ');

function wrapUpRules(turnBudget: number): string {
  return [
    `Aim for roughly ${turnBudget} exchanges, then bring the scene to a natural close.`,
    'This is a pacing guide, not a hard limit — never cut the learner off mid-thought.',
    `When the scene has genuinely finished, end your final reply with ${WRAP_UP_MARKER}`,
    'on its own line. Emit that marker only once, and never mention or explain it.',
  ].join(' ');
}

function describeMode(mode: ConversationMode): string {
  switch (mode) {
    case 'practise_recent_grammar':
      return 'Steer the conversation so the learner naturally uses the grammar listed below.';
    case 'choose_grammar':
      return 'Build the scene around the grammar listed below; give the learner openings to use it.';
    case 'role_play':
      return 'Play a character in a short everyday scene. Stay in character throughout.';
    case 'random':
      return 'Open with a light everyday topic suited to the learner and follow their lead.';
  }
}

function describeGrammar(topics: GrammarPromptTopic[]): string {
  if (topics.length === 0) {
    return '';
  }

  const lines = topics.map((topic) => {
    const parts = [`- ${topic.primaryForm} (${topic.meaning})`];
    if (topic.structure) {
      parts.push(`  structure: ${topic.structure}`);
    }
    for (const example of topic.exampleSentences ?? []) {
      parts.push(`  example: ${example}`);
    }
    return parts.join('\n');
  });

  return `\n\nGrammar to practise:\n${lines.join('\n')}`;
}

export function buildConversationSystemPrompt(options: ConversationPromptOptions): string {
  return [
    'You are a patient Japanese conversation partner for a learner practising through chat.',
    describeMode(options.mode),
    '',
    FORMAT_RULES,
    '',
    CORRECTION_RULES,
    '',
    wrapUpRules(options.turnBudget),
    'Keep each reply short — one to three sentences — so the learner can keep up.',
  ].join('\n') + describeGrammar(options.grammarTopics ?? []);
}

/**
 * Prompt for the single on-demand summary call (FR95). Asks for strict JSON so
 * the reply parses without a second round trip; a parse failure surfaces as
 * "no summary" rather than a retry loop.
 */
export function buildSummarySystemPrompt(): string {
  return [
    'You are reviewing a finished Japanese practice conversation for the learner.',
    '',
    'Respond with a single JSON object and nothing else — no prose, no code fence.',
    'Shape:',
    '{"mistakes":[{"quote":"","correction":"","note":""}],',
    ' "wordsMet":[{"text":""}],',
    ' "grammarNotes":[""]}',
    '',
    'Rules:',
    '- "mistakes": at most five, only mistakes genuinely worth fixing. Quote the',
    '  learner\'s own words, give the corrected form, and explain briefly in English.',
    '  Return an empty array if the learner made no meaningful errors.',
    '- "wordsMet": the Japanese words that came up, in plain dictionary form, no',
    '  furigana brackets. Do not judge which are new — the app decides that locally.',
    '- "grammarNotes": short English notes on the grammar the learner practised.',
  ].join('\n');
}

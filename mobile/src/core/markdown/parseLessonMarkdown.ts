import type { WordInflection } from '@/core/content/inflection';
import { parseFurigana } from '@/core/furigana/parseFurigana';

/**
 * Minimal markdown model for grammar lesson bodies (`explanation_markdown`,
 * content pipeline Phase 0.5). Deliberately small: headings, paragraphs,
 * bullet/numbered lists, blockquote callouts, and fenced blocks. Japanese
 * anywhere in prose may carry JmdictFurigana bracket notation
 * (`私[わたし]は…`) — the build pipeline's tokenizer emits it; rendering
 * resolves it via `parseFurigana`.
 *
 * Taught vocabulary words arrive as markers `{{<item-id>|<inflection>|<annotated
 * text>}}` (inflection empty or masu/te/nai/ta); `splitWordMarkers` turns them
 * into link spans. Inline code is never scanned for markers.
 *
 * Fenced-block convention: a ```jp fence marks standalone Japanese lines
 * (example sentences) that render with full furigana treatment; any other
 * fence renders as monospace text.
 */

export type InlineSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
  /** Set when the span is a taught vocabulary word; `text` is the annotated form. */
  link?: { vocabularyItemId: string; inflection: WordInflection | null };
};

export type LessonBlock =
  | { type: 'heading'; level: number; spans: InlineSpan[] }
  | { type: 'paragraph'; spans: InlineSpan[] }
  | { type: 'callout'; spans: InlineSpan[] }
  | { type: 'list'; ordered: boolean; items: InlineSpan[][] }
  | { type: 'jp'; lines: string[] }
  | { type: 'code'; lines: string[] };

/** One wrap-safe unit of a rich text line (flex-wrap layout child). */
export type RichToken = {
  /**
   * 'word': plain text (latin word or single JP character). 'ruby': annotated
   * JP run. 'linked': a taught vocabulary word (one unbreakable unit).
   */
  kind: 'word' | 'ruby' | 'linked';
  text: string;
  reading?: string;
  /** Linked only: the text without furigana brackets. */
  surface?: string;
  vocabularyItemId?: string;
  inflection?: WordInflection | null;
  /** Linked only: closing punctuation that followed the word, kept on its line. */
  trailing?: string;
  bold?: boolean;
  italic?: boolean;
  code?: boolean;
};

const HEADING_RE = /^(#{1,6})\s+(.*)$/;
const FENCE_RE = /^```([A-Za-z]*)\s*$/;
const BULLET_RE = /^[-*]\s+(.*)$/;
const ORDERED_RE = /^\d+[.)]\s+(.*)$/;
const BLOCKQUOTE_RE = /^>\s?(.*)$/;
const INLINE_RE = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
const WORD_MARKER_RE = /\{\{(\d+)\|(masu|te|nai|ta|)\|([^{}]+?)\}\}/g;

// Kana, kanji (incl. ext. A), CJK punctuation, and fullwidth forms — characters
// Japanese typography allows breaking between, so each becomes its own token.
const CJK_CHAR_RE = /[　-ヿ㐀-䶿一-鿿＀-￯]/;
// Characters that must not start a wrapped line; merged into the previous token.
const JP_CLOSING_PUNCT_RE = /^[。、！？」』）,.）…～]$/;

/** Splits `{{id|inflection|text}}` markers out of a text run into link spans. */
export function splitWordMarkers(
  text: string,
  style: Pick<InlineSpan, 'bold' | 'italic' | 'code'> = {},
): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  const re = new RegExp(WORD_MARKER_RE);
  while ((match = re.exec(text))) {
    if (match.index > cursor) {
      spans.push({ text: text.slice(cursor, match.index), ...style });
    }
    spans.push({
      text: match[3],
      ...style,
      link: {
        vocabularyItemId: match[1],
        inflection: (match[2] || null) as WordInflection | null,
      },
    });
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    spans.push({ text: text.slice(cursor), ...style });
  }

  return spans;
}

export function parseInlineSpans(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  const pushSpans = (spanText: string, style: Pick<InlineSpan, 'bold' | 'italic'>) => {
    spans.push(...splitWordMarkers(spanText, style));
  };
  let cursor = 0;
  let match: RegExpExecArray | null;

  INLINE_RE.lastIndex = 0;
  while ((match = INLINE_RE.exec(text))) {
    if (match.index > cursor) {
      pushSpans(text.slice(cursor, match.index), {});
    }
    if (match[1] !== undefined) {
      pushSpans(match[1], { bold: true });
    } else if (match[2] !== undefined) {
      pushSpans(match[2], { italic: true });
    } else {
      spans.push({ text: match[3], code: true });
    }
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    pushSpans(text.slice(cursor), {});
  }

  return spans;
}

function pushPlainTokens(
  text: string,
  style: Pick<RichToken, 'bold' | 'italic' | 'code'>,
  tokens: RichToken[],
): void {
  const pushWord = (word: string) => {
    if (word) {
      tokens.push({ kind: 'word', text: word, ...style });
    }
  };

  let latinBuffer = '';
  for (const ch of text) {
    if (!CJK_CHAR_RE.test(ch)) {
      latinBuffer += ch;
      continue;
    }
    // Flush latin text as word tokens with trailing whitespace attached.
    for (const word of latinBuffer.match(/\S+\s*|\s+/g) ?? []) {
      pushWord(word);
    }
    latinBuffer = '';

    const previous = tokens[tokens.length - 1];
    if (JP_CLOSING_PUNCT_RE.test(ch) && previous && previous.kind === 'word') {
      previous.text += ch;
    } else if (JP_CLOSING_PUNCT_RE.test(ch) && previous && previous.kind === 'linked') {
      previous.trailing = (previous.trailing ?? '') + ch;
    } else {
      pushWord(ch);
    }
  }
  for (const word of latinBuffer.match(/\S+\s*|\s+/g) ?? []) {
    pushWord(word);
  }
}

/**
 * Flattens inline spans into wrap-safe tokens for flex-wrap layout: latin
 * words stay whole, Japanese breaks per character, and bracket-annotated
 * runs become ruby tokens carrying their reading.
 */
export function tokenizeSpans(spans: InlineSpan[]): RichToken[] {
  const tokens: RichToken[] = [];

  for (const span of spans) {
    const style = { bold: span.bold, italic: span.italic, code: span.code };
    let plainRun = '';

    if (span.link) {
      tokens.push({
        kind: 'linked',
        text: span.text,
        surface: parseFurigana(span.text)
          .map((segment) => segment.text)
          .join(''),
        vocabularyItemId: span.link.vocabularyItemId,
        inflection: span.link.inflection,
        ...style,
      });
      continue;
    }

    const flushPlain = () => {
      pushPlainTokens(plainRun, style, tokens);
      plainRun = '';
    };

    for (const segment of parseFurigana(span.text)) {
      if (segment.reading) {
        flushPlain();
        tokens.push({ kind: 'ruby', text: segment.text, reading: segment.reading, ...style });
      } else {
        plainRun += segment.text;
      }
    }
    flushPlain();
  }

  return tokens;
}

/** True when any span carries a furigana annotation (needs ruby layout). */
export function spansHaveFurigana(spans: InlineSpan[]): boolean {
  return spans.some((span) => parseFurigana(span.text).some((segment) => segment.reading));
}

/** True when any span needs token layout: a furigana annotation or a word link. */
export function spansNeedTokens(spans: InlineSpan[]): boolean {
  return spans.some((span) => span.link !== undefined) || spansHaveFurigana(spans);
}

export function parseLessonMarkdown(markdown: string): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();

    if (!trimmed) {
      index += 1;
      continue;
    }

    const fenceMatch = trimmed.match(FENCE_RE);
    if (fenceMatch) {
      const language = fenceMatch[1].toLowerCase();
      const fenceLines: string[] = [];
      index += 1;
      while (index < lines.length && !FENCE_RE.test(lines[index].trim())) {
        fenceLines.push(lines[index]);
        index += 1;
      }
      index += 1; // skip closing fence (or run off the end on an unclosed one)
      const content = fenceLines.filter((fenceLine) => fenceLine.trim().length > 0);
      blocks.push(
        language === 'jp' || language === 'japanese'
          ? { type: 'jp', lines: content.map((fenceLine) => fenceLine.trim()) }
          : { type: 'code', lines: fenceLines },
      );
      continue;
    }

    const headingMatch = trimmed.match(HEADING_RE);
    if (headingMatch) {
      blocks.push({
        type: 'heading',
        level: headingMatch[1].length,
        spans: parseInlineSpans(headingMatch[2].trim()),
      });
      index += 1;
      continue;
    }

    const blockquoteMatch = trimmed.match(BLOCKQUOTE_RE);
    if (blockquoteMatch) {
      const quoteLines: string[] = [];
      while (index < lines.length) {
        const quoteMatch = lines[index].trim().match(BLOCKQUOTE_RE);
        if (!quoteMatch) {
          break;
        }
        quoteLines.push(quoteMatch[1]);
        index += 1;
      }
      blocks.push({
        type: 'callout',
        spans: parseInlineSpans(quoteLines.join(' ').trim()),
      });
      continue;
    }

    const bulletMatch = trimmed.match(BULLET_RE);
    const orderedMatch = trimmed.match(ORDERED_RE);
    if (bulletMatch || orderedMatch) {
      const ordered = Boolean(orderedMatch);
      const itemRe = ordered ? ORDERED_RE : BULLET_RE;
      const items: InlineSpan[][] = [];
      while (index < lines.length) {
        const itemMatch = lines[index].trim().match(itemRe);
        if (!itemMatch) {
          break;
        }
        items.push(parseInlineSpans(itemMatch[1]));
        index += 1;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    // Paragraph: consecutive plain lines joined by a space (markdown soft wrap).
    const paragraphLines: string[] = [];
    while (index < lines.length) {
      const paragraphLine = lines[index].trim();
      if (
        !paragraphLine ||
        FENCE_RE.test(paragraphLine) ||
        HEADING_RE.test(paragraphLine) ||
        BLOCKQUOTE_RE.test(paragraphLine) ||
        BULLET_RE.test(paragraphLine) ||
        ORDERED_RE.test(paragraphLine)
      ) {
        break;
      }
      paragraphLines.push(paragraphLine);
      index += 1;
    }
    blocks.push({ type: 'paragraph', spans: parseInlineSpans(paragraphLines.join(' ')) });
  }

  return blocks;
}

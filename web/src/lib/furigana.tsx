import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { WordSpan } from '../types/curriculumRaw';

const FURIGANA_PATTERN = /([^[\]]+?)\[([^[\]]+?)\]/g;
const BLANK = '＿';

type Segment = {
  /** Plain-text (no brackets) offset range this segment covers, matching WordSpan start/end. */
  start: number;
  end: number;
  base: string;
  reading?: string;
};

/** Splits `字[よみ]` bracket text into plain and ruby segments, offset against the bracket-free text. */
export function parseFurigana(text: string): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  let plainOffset = 0;
  FURIGANA_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = FURIGANA_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) {
      const plain = text.slice(cursor, match.index);
      segments.push({ start: plainOffset, end: plainOffset + plain.length, base: plain });
      plainOffset += plain.length;
    }
    const base = match[1];
    segments.push({ start: plainOffset, end: plainOffset + base.length, base, reading: match[2] });
    plainOffset += base.length;
    cursor = FURIGANA_PATTERN.lastIndex;
  }

  if (cursor < text.length) {
    const plain = text.slice(cursor);
    segments.push({ start: plainOffset, end: plainOffset + plain.length, base: plain });
  }

  return segments;
}

function renderBase(base: string, key: string | number): ReactNode {
  if (!base.includes(BLANK)) return <Fragment key={key}>{base}</Fragment>;
  const parts = base.split(BLANK);
  return (
    <Fragment key={key}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 ? <mark className="cloze-blank">{BLANK}</mark> : null}
        </Fragment>
      ))}
    </Fragment>
  );
}

function renderSegment(segment: Segment, showReadings: boolean, key: string | number): ReactNode {
  if (segment.reading && showReadings) {
    return (
      <ruby key={key}>
        {segment.base}
        <rt>{segment.reading}</rt>
      </ruby>
    );
  }
  return renderBase(segment.base, key);
}

type FuriganaTextProps = {
  text: string;
  showReadings: boolean;
};

/** Renders `字[よみ]` bracket text, toggling ruby annotations on/off. */
export function FuriganaText({ text, showReadings }: FuriganaTextProps) {
  const segments = parseFurigana(text);
  return <>{segments.map((s, i) => renderSegment(s, showReadings, i))}</>;
}

type AnnotatedSentenceProps = {
  text: string;
  furigana?: string;
  wordSpans?: WordSpan[];
  showReadings: boolean;
};

/**
 * Renders a sentence with furigana (if provided) and clickable/highlighted word spans.
 * WordSpan offsets are into the bracket-free plain text, which matches the accumulated
 * base-length offsets of the parsed furigana segments — see parseFurigana.
 */
export function AnnotatedSentence({ text, furigana, wordSpans, showReadings }: AnnotatedSentenceProps) {
  const segments = parseFurigana(furigana ?? text);
  const spans = [...(wordSpans ?? [])].sort((a, b) => a.start - b.start);

  const nodes: ReactNode[] = [];
  let spanIdx = 0;
  let group: { span: WordSpan; children: ReactNode[] } | null = null;

  const flushGroup = () => {
    if (!group) return;
    nodes.push(
      <Link
        key={`span-${group.span.vocabulary_slug}-${group.span.start}`}
        to={`/content/vocabulary/${group.span.vocabulary_slug}`}
        className="word-span"
        title={group.span.vocabulary_slug}
      >
        {group.children}
      </Link>,
    );
    group = null;
  };

  segments.forEach((segment, i) => {
    while (spanIdx < spans.length && spans[spanIdx].end <= segment.start) {
      spanIdx += 1;
    }
    const span = spans[spanIdx];
    const inSpan = span && segment.start >= span.start && segment.end <= span.end;

    if (inSpan) {
      if (!group || group.span !== span) {
        flushGroup();
        group = { span, children: [] };
      }
      group.children.push(renderSegment(segment, showReadings, i));
    } else {
      flushGroup();
      nodes.push(renderSegment(segment, showReadings, i));
    }
  });
  flushGroup();

  return <>{nodes}</>;
}

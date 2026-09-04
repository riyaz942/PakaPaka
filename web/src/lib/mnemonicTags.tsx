import { Fragment } from 'react';

const TAG_PATTERN = /<(radical|kanji|vocabulary|reading)>(.*?)<\/\1>/g;

type Props = {
  text: string | undefined;
};

/** Renders mnemonic prose, turning <radical>/<kanji>/<vocabulary>/<reading> tags into highlighted chips. */
export function MnemonicText({ text }: Props) {
  if (!text) return null;

  const nodes = [];
  let cursor = 0;
  TAG_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = TAG_PATTERN.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(<Fragment key={key++}>{text.slice(cursor, match.index)}</Fragment>);
    }
    const [, tag, content] = match;
    nodes.push(
      <span key={key++} className={`mnemonic-tag mnemonic-tag--${tag}`}>
        {content}
      </span>,
    );
    cursor = TAG_PATTERN.lastIndex;
  }
  if (cursor < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(cursor)}</Fragment>);
  }

  return <>{nodes}</>;
}

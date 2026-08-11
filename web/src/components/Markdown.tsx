import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useMemo } from 'react';

type Props = {
  text: string;
};

export function Markdown({ text }: Props) {
  const html = useMemo(() => {
    const parsed = marked.parse(text, { async: false });
    return DOMPurify.sanitize(parsed);
  }, [text]);

  return <div className="markdown-block" dangerouslySetInnerHTML={{ __html: html }} />;
}

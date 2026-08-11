import { RelatedChips } from '../../components/RelatedChips';
import { AnnotatedSentence } from '../../lib/furigana';
import type { ReadingRaw } from '../../types/curriculumRaw';

type Props = {
  raw: ReadingRaw;
  showReadings: boolean;
};

export function ReadingDetail({ raw, showReadings }: Props) {
  const questions = [...(raw.questions ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  return (
    <div className="panel">
      <h3 className="panel-title">Body</h3>
      <p className="reading-body">
        <AnnotatedSentence
          text={raw.body}
          furigana={raw.body_furigana}
          wordSpans={raw.word_spans}
          showReadings={showReadings}
        />
      </p>

      {raw.english_translation ? (
        <>
          <h3 className="panel-title">Translation</h3>
          <p>{raw.english_translation}</p>
        </>
      ) : null}

      {raw.summary_ja ? (
        <>
          <h3 className="panel-title">Summary (Japanese)</h3>
          <p>{raw.summary_ja}</p>
        </>
      ) : null}

      {raw.summary_en ? (
        <>
          <h3 className="panel-title">Summary (English)</h3>
          <p>{raw.summary_en}</p>
        </>
      ) : null}

      <h3 className="panel-title">Questions</h3>
      {questions.length === 0 ? (
        <p className="panel-muted">None recorded.</p>
      ) : (
        <ul className="example-list">
          {questions.map((q, i) => (
            <li key={i} className="example-item">
              <p className="example-japanese">
                <AnnotatedSentence text={q.prompt} furigana={q.prompt_furigana} showReadings={showReadings} />
              </p>
              <p className="panel-muted">Accepted: {q.accepted_answers.join(' / ')}</p>
            </li>
          ))}
        </ul>
      )}

      <h3 className="panel-title">Grammar used</h3>
      <RelatedChips type="grammar" slugs={raw.grammar_slugs} emptyLabel="None recorded." />

      <h3 className="panel-title">Vocabulary used</h3>
      <RelatedChips type="vocabulary" slugs={raw.vocabulary_slugs} emptyLabel="None recorded." />
    </div>
  );
}

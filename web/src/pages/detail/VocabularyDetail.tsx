import { ExampleSentences } from '../../components/ExampleSentences';
import { FuriganaText } from '../../lib/furigana';
import { MnemonicText } from '../../lib/mnemonicTags';
import type { VocabRaw } from '../../types/curriculumRaw';

type Props = {
  raw: VocabRaw;
  showReadings: boolean;
};

export function VocabularyDetail({ raw, showReadings }: Props) {
  const answers = raw.accepted_answers ?? [];

  return (
    <div className="panel">
      {raw.furigana ? (
        <p className="vocab-furigana">
          <FuriganaText text={raw.furigana} showReadings={showReadings} />
        </p>
      ) : null}

      <h3 className="panel-title">Accepted answers</h3>
      {answers.length === 0 ? (
        <p className="panel-muted">None.</p>
      ) : (
        <ul className="answer-list">
          {answers.map((a, i) => (
            <li key={i}>
              <span className="answer-type">{a.answer_type}</span> {a.answer_text}
              {a.is_primary ? <span className="answer-primary">primary</span> : null}
            </li>
          ))}
        </ul>
      )}

      {raw.meaning_mnemonic ? (
        <>
          <h3 className="panel-title">Meaning mnemonic</h3>
          <p className="mnemonic-text">
            <MnemonicText text={raw.meaning_mnemonic} />
          </p>
        </>
      ) : null}

      {raw.reading_mnemonic ? (
        <>
          <h3 className="panel-title">Reading mnemonic</h3>
          <p className="mnemonic-text">
            <MnemonicText text={raw.reading_mnemonic} />
          </p>
        </>
      ) : null}

      {raw.description ? (
        <>
          <h3 className="panel-title">Description</h3>
          <p className="mnemonic-text">
            <MnemonicText text={raw.description} />
          </p>
        </>
      ) : null}

      <h3 className="panel-title">Example sentences</h3>
      <ExampleSentences
        sentences={raw.example_sentences}
        showReadings={showReadings}
        generatorModel={raw._meta?.generator_model}
      />
    </div>
  );
}

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

      <h3 className="panel-title">Word type</h3>
      {raw.word_type ? (
        <p className="mnemonic-text">{raw.word_type}</p>
      ) : (
        <p className="panel-muted">
          None — a compound or derived form with no single part of speech.
        </p>
      )}

      <h3 className="panel-title">Reading composition</h3>
      {raw.reading_composition ? (
        <p className="mnemonic-text">{raw.reading_composition}</p>
      ) : (
        <p className="panel-muted">None — this word ships no reading.</p>
      )}

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

      {/* Unlike the meaning mnemonic, this panel shows even when empty. From
          Rev 6 most words correctly have no reading mnemonic — the composition
          above is the whole story — and a reviewer needs to be able to tell
          that absence apart from a word whose reading prose is still missing. */}
      <h3 className="panel-title">Reading mnemonic</h3>
      {raw.reading_mnemonic ? (
        <p className="mnemonic-text">
          <MnemonicText text={raw.reading_mnemonic} />
        </p>
      ) : (
        <p className="panel-muted">
          None — the reading needs no hook beyond the composition above.
        </p>
      )}

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

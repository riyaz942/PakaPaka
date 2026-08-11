import { ExampleSentences } from '../../components/ExampleSentences';
import { RelatedChips } from '../../components/RelatedChips';
import { MnemonicText } from '../../lib/mnemonicTags';
import type { KanjiRaw } from '../../types/curriculumRaw';

type Props = {
  raw: KanjiRaw;
  showReadings: boolean;
};

export function KanjiDetail({ raw, showReadings }: Props) {
  const readings = [...(raw.readings ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const answers = raw.accepted_answers ?? [];

  return (
    <div className="panel">
      <h3 className="panel-title">Readings</h3>
      {readings.length === 0 ? (
        <p className="panel-muted">None recorded.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Reading</th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r, i) => (
              <tr key={i}>
                <td>{r.reading_type === 'onyomi' ? "On'yomi" : "Kun'yomi"}</td>
                <td>{r.reading}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

      <h3 className="panel-title">Visually similar</h3>
      <RelatedChips type="kanji" slugs={raw.visually_similar_slugs} emptyLabel="None recorded." />

      <h3 className="panel-title">Example sentences</h3>
      <ExampleSentences sentences={raw.example_sentences} showReadings={showReadings} />
    </div>
  );
}

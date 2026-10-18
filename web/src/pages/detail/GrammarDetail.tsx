import { ExampleSentences } from '../../components/ExampleSentences';
import { Markdown } from '../../components/Markdown';
import { RelatedChips } from '../../components/RelatedChips';
import { ReviewStatusControl } from '../../components/ReviewStatusControl';
import { StatusBadge } from '../../components/StatusBadge';
import { AnnotatedSentence, stripWordMarkers } from '../../lib/furigana';
import { MnemonicText } from '../../lib/mnemonicTags';
import type { ReviewStatus } from '../../types/api';
import type { GrammarRaw } from '../../types/curriculumRaw';

type Props = {
  raw: GrammarRaw;
  showReadings: boolean;
  slug: string;
  mnemonicReviewStatus: ReviewStatus | null;
  onChanged: () => void;
};

export function GrammarDetail({ raw, showReadings, slug, mnemonicReviewStatus, onChanged }: Props) {
  const clozeVariants = [...(raw.cloze_variants ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );
  const conjugationEntries = Object.entries(raw.conjugation_rules ?? {});

  return (
    <div className="panel">
      <h3 className="panel-title">Structure</h3>
      <p className="grammar-structure">{raw.structure}</p>
      {raw.family ? <span className="grammar-family">{raw.family}</span> : null}

      <h3 className="panel-title">Mnemonic</h3>
      {raw.mnemonic_text ? (
        <>
          <p className="mnemonic-text">
            <MnemonicText text={raw.mnemonic_text} />
          </p>
          <div className="item-header__badges">
            <span className="panel-muted">Mnemonic status:</span>
            <StatusBadge status={mnemonicReviewStatus ?? 'none'} />
            <ReviewStatusControl
              type="grammar"
              slug={slug}
              status={mnemonicReviewStatus ?? 'none'}
              endpoint="mnemonic-meta"
              onChanged={onChanged}
            />
          </div>
        </>
      ) : (
        <p className="panel-muted">No mnemonic yet.</p>
      )}

      {raw.uses && raw.uses.length > 0 ? (
        <>
          <h3 className="panel-title">Uses ({raw.uses.length})</h3>
          <ol className="example-list">
            {raw.uses.map((use, i) => (
              <li key={i} className="example-item">
                <p>
                  <strong>
                    {i + 1}. {use.label}
                  </strong>
                </p>
                <p className="grammar-structure">{use.structure}</p>
                <p className="example-japanese">
                  <AnnotatedSentence
                    text={use.japanese}
                    furigana={use.furigana}
                    showReadings={showReadings}
                  />
                </p>
                <p className="example-english">{use.english}</p>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {raw.explanation_markdown ? (
        <>
          <h3 className="panel-title">Explanation</h3>
          <Markdown text={stripWordMarkers(raw.explanation_markdown)} />
        </>
      ) : null}

      {raw.caution_notes && raw.caution_notes.length > 0 ? (
        <>
          <h3 className="panel-title">Caution notes</h3>
          <ul className="caution-list">
            {raw.caution_notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </>
      ) : null}

      <h3 className="panel-title">Accepted forms</h3>
      {raw.accepted_forms.length === 0 ? (
        <p className="panel-muted">None.</p>
      ) : (
        <div className="chip-row">
          {raw.accepted_forms.map((form, i) => (
            <span key={i} className="related-chip related-chip--static">
              {form}
            </span>
          ))}
        </div>
      )}

      {conjugationEntries.length > 0 ? (
        <>
          <h3 className="panel-title">Conjugation rules</h3>
          <table className="data-table">
            <tbody>
              {conjugationEntries.map(([key, value]) => (
                <tr key={key}>
                  <td>{key}</td>
                  <td>{typeof value === 'string' ? value : JSON.stringify(value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {clozeVariants.length > 0 ? (
        <>
          <h3 className="panel-title">Cloze variants</h3>
          <ul className="example-list">
            {clozeVariants.map((c, i) => (
              <li key={i} className="example-item">
                <p className="example-japanese">
                  <AnnotatedSentence
                    text={c.jp_cloze}
                    furigana={c.jp_cloze_furigana}
                    showReadings={showReadings}
                  />
                </p>
                <p className="example-english">{c.english}</p>
                <p className="cloze-answer">
                  Answer: <strong>{c.answer}</strong>
                </p>
                {c.nudge ? <p className="panel-muted">{c.nudge}</p> : null}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h3 className="panel-title">Related grammar</h3>
      <RelatedChips type="grammar" slugs={raw.related_grammar_slugs} emptyLabel="None recorded." />

      {raw.vocabulary_slugs && raw.vocabulary_slugs.length > 0 ? (
        <>
          <h3 className="panel-title">Vocabulary used</h3>
          <RelatedChips type="vocabulary" slugs={raw.vocabulary_slugs} />
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

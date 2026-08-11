import { useState } from 'react';
import { RelatedChips } from '../../components/RelatedChips';
import { MnemonicText } from '../../lib/mnemonicTags';
import type { RadicalRaw } from '../../types/curriculumRaw';

type Props = {
  raw: RadicalRaw;
};

export function RadicalDetail({ raw }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  const primaryAnswers = raw.accepted_answers ?? [];

  return (
    <div className="panel">
      <div className="radical-visual">
        {raw.visual_mnemonic_url && !imageFailed ? (
          <img
            src={`/assets/${raw.visual_mnemonic_url}`}
            alt={raw.meaning}
            className="radical-visual__image"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="radical-visual__fallback">{raw.primary_form}</div>
        )}
      </div>

      <h3 className="panel-title">Accepted answers</h3>
      {primaryAnswers.length === 0 ? (
        <p className="panel-muted">None.</p>
      ) : (
        <ul className="answer-list">
          {primaryAnswers.map((a, i) => (
            <li key={i}>
              {a.answer_text}
              {a.is_primary ? <span className="answer-primary">primary</span> : null}
            </li>
          ))}
        </ul>
      )}

      {raw.mnemonic_text ? (
        <>
          <h3 className="panel-title">Mnemonic</h3>
          <p className="mnemonic-text">
            <MnemonicText text={raw.mnemonic_text} />
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

      <h3 className="panel-title">Look-alikes</h3>
      <RelatedChips
        type="radical"
        slugs={raw.visually_similar_slugs}
        emptyLabel="None recorded."
      />
    </div>
  );
}

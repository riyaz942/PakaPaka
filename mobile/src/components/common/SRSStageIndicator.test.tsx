import { render, screen } from '@testing-library/react-native';

import type { SRSStageLabel } from '@/core/srs/srs.types';

import { SRSStageIndicator } from './SRSStageIndicator';

/**
 * Stage labels borrow their content twin's `-deep` step (Session 4's mapping) —
 * the base `srs-*` hues do not clear AA for a 12px label on a plain background.
 */
const STAGE_TOKEN_CLASS: Record<SRSStageLabel, string> = {
  apprentice: 'text-content-kanji-deep',
  guru: 'text-content-vocabulary-deep',
  master: 'text-content-radical-deep',
  enlightened: 'text-srs-enlightened-deep',
  burned: 'text-muted',
};

const STAGES: SRSStageLabel[] = ['apprentice', 'guru', 'master', 'enlightened', 'burned'];

describe('SRSStageIndicator', () => {
  for (const stage of STAGES) {
    it(`renders label text for stage "${stage}"`, () => {
      render(<SRSStageIndicator stage={stage} />);
      const capitalized = stage.charAt(0).toUpperCase() + stage.slice(1);
      expect(screen.getByText(capitalized)).toBeTruthy();
    });

    it(`has correct accessibilityLabel for stage "${stage}"`, () => {
      render(<SRSStageIndicator stage={stage} />);
      const capitalized = stage.charAt(0).toUpperCase() + stage.slice(1);
      expect(
        screen.getByLabelText(`SRS stage: ${capitalized}`),
      ).toBeTruthy();
    });

    it(`applies design token class for stage "${stage}"`, () => {
      render(<SRSStageIndicator stage={stage} />);
      const capitalized = stage.charAt(0).toUpperCase() + stage.slice(1);
      const node = screen.getByText(capitalized);
      expect(node.props.className).toContain(STAGE_TOKEN_CLASS[stage]);
    });
  }
});

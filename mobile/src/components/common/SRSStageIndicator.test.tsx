import { render, screen } from '@testing-library/react-native';

import type { SRSStageLabel } from '@/core/srs/srs.types';

import { SRSStageIndicator } from './SRSStageIndicator';

const STAGE_TOKEN_CLASS: Record<SRSStageLabel, string> = {
  apprentice: 'text-srs-apprentice',
  guru: 'text-srs-guru',
  master: 'text-srs-master',
  enlightened: 'text-srs-enlightened',
  burned: 'text-srs-burned',
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

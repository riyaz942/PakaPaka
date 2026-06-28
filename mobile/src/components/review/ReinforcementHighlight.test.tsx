import { render, screen } from '@testing-library/react-native';

import type { ReinforcementLink } from '@/core/content/content.types';

import { ReinforcementHighlight } from './ReinforcementHighlight';

const link: ReinforcementLink = {
  relatedItemId: '20',
  primaryForm: '食べる',
  meaning: 'to eat',
  relationshipType: 'reinforces',
  srsStageLabel: 'guru',
  recencyPhrase: 'you learned this yesterday',
  displayText: '食べる — you learned this yesterday',
};

describe('ReinforcementHighlight', () => {
  it('renders link text with supplementary a11y label', () => {
    render(<ReinforcementHighlight link={link} />);
    expect(screen.getByText('食べる — you learned this yesterday')).toBeTruthy();
    expect(screen.getByLabelText('Reinforcement: 食べる — you learned this yesterday')).toBeTruthy();
  });

  it('renders nothing when link is absent', () => {
    const { toJSON } = render(<ReinforcementHighlight link={null} />);
    expect(toJSON()).toBeNull();
  });
});

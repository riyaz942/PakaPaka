import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { ItemDetailHeaderBar } from '@/components/learn/ItemDetailHeaderBar';
import type { ItemHeaderMeta } from '@/data/hooks/useItemHeaderMeta';

let mockMeta: ItemHeaderMeta = { itemType: null, srsStage: null };

jest.mock('@/data/hooks/useItemHeaderMeta', () => ({
  useItemHeaderMeta: () => mockMeta,
}));

describe('ItemDetailHeaderBar', () => {
  it('names the type and the SRS stage', () => {
    mockMeta = { itemType: 'kanji', srsStage: 'guru' };
    render(<ItemDetailHeaderBar itemId="10" />);

    expect(screen.getByText('KANJI')).toBeTruthy();
    expect(screen.getByText('Guru')).toBeTruthy();
    expect(screen.getByLabelText('SRS stage: Guru')).toBeTruthy();
  });

  it('drops the stage pill for an item that has never been taught', () => {
    mockMeta = { itemType: 'radical', srsStage: null };
    render(<ItemDetailHeaderBar itemId="10" />);

    expect(screen.getByText('RADICAL')).toBeTruthy();
    expect(screen.queryByTestId('item-detail-stage-pill')).toBeNull();
  });

  it('renders nothing until the item resolves', () => {
    mockMeta = { itemType: null, srsStage: null };
    render(<ItemDetailHeaderBar itemId={null} />);

    expect(screen.queryByTestId('item-detail-type-badge')).toBeNull();
    expect(screen.queryByTestId('item-detail-stage-pill')).toBeNull();
  });
});

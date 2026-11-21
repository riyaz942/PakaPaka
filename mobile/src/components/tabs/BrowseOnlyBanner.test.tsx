import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { BrowseOnlyBanner } from '@/components/tabs/BrowseOnlyBanner';
import { TabModeContext } from '@/providers/TabModeContext';

function renderBanner(browseOnly: boolean) {
  const useHere = jest.fn();
  render(
    <TabModeContext.Provider value={{ browseOnly, useHere }}>
      <BrowseOnlyBanner />
    </TabModeContext.Provider>,
  );
  return { useHere };
}

describe('BrowseOnlyBanner', () => {
  it('renders nothing when the tab is not browse-only', () => {
    renderBanner(false);
    expect(screen.queryByText(/Browse only/)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the exact copy in a browse-only tab', () => {
    renderBanner(true);
    expect(
      screen.getByText('Browse only. Reviews and lessons run in your other tab.'),
    ).toBeTruthy();
  });

  it('Use here calls useHere', () => {
    const { useHere } = renderBanner(true);
    fireEvent.press(screen.getByRole('button', { name: 'Use here' }));
    expect(useHere).toHaveBeenCalledTimes(1);
  });
});

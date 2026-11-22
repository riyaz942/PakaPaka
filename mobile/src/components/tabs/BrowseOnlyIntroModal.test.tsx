import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { BrowseOnlyIntroModal } from '@/components/tabs/BrowseOnlyIntroModal';

function renderModal(browsePending = false) {
  const onBrowse = jest.fn();
  const onUseHere = jest.fn();
  render(
    <BrowseOnlyIntroModal
      browsePending={browsePending}
      onBrowse={onBrowse}
      onUseHere={onUseHere}
    />,
  );
  return { onBrowse, onUseHere };
}

describe('BrowseOnlyIntroModal', () => {
  it('shows the exact copy', () => {
    renderModal();

    expect(screen.getByText('PakaPaka is already open in another tab')).toBeTruthy();
    expect(
      screen.getByText(
        'Only one tab can save your progress. So this tab cannot run reviews or lessons right now.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Look up kanji, words and passages in this tab. Your review in the other tab keeps going. Progress here is from when this tab opened.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Move PakaPaka to this tab. The other tab stops. Answers you gave there are saved.',
      ),
    ).toBeTruthy();
  });

  it('Browse and Use here call their handlers', () => {
    const { onBrowse, onUseHere } = renderModal();

    fireEvent.press(screen.getByRole('button', { name: 'Browse' }));
    fireEvent.press(screen.getByRole('button', { name: 'Use here' }));

    expect(onBrowse).toHaveBeenCalledTimes(1);
    expect(onUseHere).toHaveBeenCalledTimes(1);
  });

  it('Browse shows a spinner and is disabled while the copy is pending', () => {
    const { onBrowse, onUseHere } = renderModal(true);

    expect(screen.getByTestId('browse-pending-spinner')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Browse' }));
    expect(onBrowse).not.toHaveBeenCalled();
    fireEvent.press(screen.getByRole('button', { name: 'Use here' }));
    expect(onUseHere).toHaveBeenCalledTimes(1);
  });

  it('has no spinner when nothing is pending', () => {
    renderModal(false);
    expect(screen.queryByTestId('browse-pending-spinner')).toBeNull();
  });

  it('has no close control', () => {
    renderModal();
    expect(screen.queryByLabelText(/close/i)).toBeNull();
    expect(screen.queryByLabelText(/dismiss/i)).toBeNull();
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});

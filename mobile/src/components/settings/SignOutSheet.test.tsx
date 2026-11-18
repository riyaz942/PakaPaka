import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { SignOutSheet } from './SignOutSheet';

const baseProps = {
  visible: true,
  everywhere: false,
  step: 'confirm' as const,
  busy: false,
  syncError: null,
  onConfirm: jest.fn(),
  onEraseAnyway: jest.fn(),
  onCancel: jest.fn(),
};

describe('SignOutSheet', () => {
  it('confirm step shows the exact copy', () => {
    const onConfirm = jest.fn();
    render(<SignOutSheet {...baseProps} onConfirm={onConfirm} />);

    expect(screen.getByText('Sign out?')).toBeTruthy();
    expect(
      screen.getByText(
        'Your progress syncs first. Then it is erased from this device. Sign in again to get it back.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/Your other devices are signed out too/)).toBeNull();

    fireEvent.press(screen.getByLabelText('Sync and sign out'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Cancel')).toBeTruthy();
  });

  it('confirm step for everywhere adds the other-devices paragraph', () => {
    render(<SignOutSheet {...baseProps} everywhere />);

    expect(screen.getByText('Sign out everywhere?')).toBeTruthy();
    expect(
      screen.getByText(
        'Your progress syncs first. Then it is erased from this device. Sign in again to get it back.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Your other devices are signed out too. Each one erases its progress. If a device has progress that is not synced, it asks first.',
      ),
    ).toBeTruthy();
  });

  it('sync failed step shows the error and the exact copy', () => {
    const onConfirm = jest.fn();
    const onEraseAnyway = jest.fn();
    const onCancel = jest.fn();
    render(
      <SignOutSheet
        {...baseProps}
        step="sync_failed"
        syncError="No connection."
        onConfirm={onConfirm}
        onEraseAnyway={onEraseAnyway}
        onCancel={onCancel}
      />,
    );

    expect(screen.getByText('Sync did not finish')).toBeTruthy();
    expect(
      screen.getByText(
        'No connection. If you erase now, progress that is not synced yet is lost.',
      ),
    ).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Try again'));
    fireEvent.press(screen.getByLabelText('Erase anyway'));
    fireEvent.press(screen.getByLabelText('Cancel'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onEraseAnyway).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('sync failed step without an error says the sync did not finish', () => {
    render(<SignOutSheet {...baseProps} step="sync_failed" />);

    expect(
      screen.getByText(
        'The sync did not finish. If you erase now, progress that is not synced yet is lost.',
      ),
    ).toBeTruthy();
  });

  it('buttons are disabled and the label is Syncing… while busy', () => {
    render(<SignOutSheet {...baseProps} busy />);

    expect(screen.getByLabelText('Syncing…').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.getByLabelText('Cancel').props.accessibilityState).toMatchObject({
      disabled: true,
    });
    expect(screen.queryByLabelText('Sync and sign out')).toBeNull();
  });
});

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { SignOutSheet } from './SignOutSheet';

describe('SignOutSheet', () => {
  it('erase step shows the exact copy', () => {
    render(<SignOutSheet visible everywhere={false} onConfirm={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.press(screen.getByLabelText('Sign out and erase my data'));

    expect(
      screen.getByText(
        'This erases all your progress and settings on this device. Progress that is not synced yet is lost. To keep it, cancel and tap Sync now first.',
      ),
    ).toBeTruthy();
  });

  it('sign-out step says the synced copy stays on the server', () => {
    render(<SignOutSheet visible everywhere={false} onConfirm={jest.fn()} onCancel={jest.fn()} />);

    expect(
      screen.getByText(/The copy that is already synced stays on our server until you delete your account\./),
    ).toBeTruthy();
  });
});

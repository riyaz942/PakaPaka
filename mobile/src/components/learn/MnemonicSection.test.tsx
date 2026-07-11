import { fireEvent, render, screen } from '@testing-library/react-native';

import { MnemonicSection, __resetMnemonicSessionMemoryForTests } from './MnemonicSection';

describe('MnemonicSection', () => {
  beforeEach(() => {
    __resetMnemonicSessionMemoryForTests();
  });

  it('always shows the mnemonic when not collapsible', () => {
    render(<MnemonicSection mnemonicText="A tree with roots" />);

    expect(screen.getByText('A tree with roots')).toBeTruthy();
    expect(screen.queryByTestId('mnemonic-disclosure')).toBeNull();
  });

  it('starts collapsed and expands on tap when collapsible', () => {
    render(<MnemonicSection mnemonicText="A tree with roots" collapsible />);

    expect(screen.queryByText('A tree with roots')).toBeNull();
    const disclosure = screen.getByTestId('mnemonic-disclosure');
    expect(disclosure.props.accessibilityState.expanded).toBe(false);

    fireEvent.press(disclosure);

    expect(screen.getByText('A tree with roots')).toBeTruthy();
    expect(
      screen.getByTestId('mnemonic-disclosure').props.accessibilityState.expanded,
    ).toBe(true);
  });

  it('remembers expansion across items within the session', () => {
    const first = render(<MnemonicSection mnemonicText="First mnemonic" collapsible />);
    fireEvent.press(screen.getByTestId('mnemonic-disclosure'));
    expect(screen.getByText('First mnemonic')).toBeTruthy();
    first.unmount();

    render(<MnemonicSection mnemonicText="Second mnemonic" collapsible />);
    expect(screen.getByText('Second mnemonic')).toBeTruthy();
  });

  it('collapses again on a second tap and remembers that too', () => {
    const first = render(<MnemonicSection mnemonicText="First mnemonic" collapsible />);
    fireEvent.press(screen.getByTestId('mnemonic-disclosure'));
    fireEvent.press(screen.getByTestId('mnemonic-disclosure'));
    expect(screen.queryByText('First mnemonic')).toBeNull();
    first.unmount();

    render(<MnemonicSection mnemonicText="Second mnemonic" collapsible />);
    expect(screen.queryByText('Second mnemonic')).toBeNull();
  });
});

import { fireEvent, render, screen } from '@testing-library/react-native';

import { Button } from './Button';

describe('Button', () => {
  it('fires onPress and clears the 44px tap-target floor', () => {
    const onPress = jest.fn();
    render(<Button label="Continue" onPress={onPress} testID="cta" />);

    fireEvent.press(screen.getByTestId('cta'));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByTestId('cta').props.className).toContain('min-h-[48px]');
  });

  it('fills primary with jade and a white label — not the pre-v2 blue accent', () => {
    render(<Button label="Continue" onPress={jest.fn()} testID="cta" />);

    const className = screen.getByTestId('cta').props.className;
    expect(className).toContain('bg-brand-600');
    expect(className).not.toContain('feedback-info');
    expect(screen.getByText('Continue').props.className).toContain('text-on-primary');
  });

  it('outlines secondary in jade on a plain surface', () => {
    render(<Button label="Explore" onPress={jest.fn()} variant="secondary" testID="cta" />);

    expect(screen.getByTestId('cta').props.className).toContain('border-brand-500');
    expect(screen.getByText('Explore').props.className).toContain('text-brand-text');
  });

  it('uses a real danger fill for destructive, not a token that does not exist', () => {
    render(<Button label="Reset progress" onPress={jest.fn()} variant="destructive" testID="cta" />);

    expect(screen.getByTestId('cta').props.className).toContain('bg-feedback-incorrect-fill');
  });

  it('greys a disabled button instead of tinting it brand', () => {
    const onPress = jest.fn();
    render(<Button label="Continue" onPress={onPress} disabled testID="cta" />);

    const button = screen.getByTestId('cta');
    expect(button.props.className).toContain('bg-surface-elevated');
    expect(button.props.className).not.toContain('bg-brand-600');
    expect(screen.getByText('Continue').props.className).toContain('text-faint');

    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });

  // A shadow class declares a CSS variable, and NativeWind remounts an element
  // that only starts declaring variables after its first render. Toggling
  // `disabled` must not add or drop one, or the button remounts under the user.
  it.each(['primary', 'secondary', 'tertiary', 'ghost', 'destructive'] as const)(
    'keeps a shadow utility on %s in both the enabled and disabled state',
    (variant) => {
      render(<Button label="Continue" onPress={jest.fn()} variant={variant} testID="cta" />);
      expect(screen.getByTestId('cta').props.className).toMatch(/(^|\s)shadow-/);

      screen.rerender(
        <Button label="Continue" onPress={jest.fn()} variant={variant} disabled testID="cta" />,
      );
      expect(screen.getByTestId('cta').props.className).toMatch(/(^|\s)shadow-/);
    },
  );

  it('reports the disabled state to assistive tech', () => {
    render(<Button label="Continue" onPress={jest.fn()} disabled testID="cta" />);
    expect(screen.getByTestId('cta').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

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

  it('reports the disabled state to assistive tech', () => {
    render(<Button label="Continue" onPress={jest.fn()} disabled testID="cta" />);
    expect(screen.getByTestId('cta').props.accessibilityState).toMatchObject({ disabled: true });
  });
});

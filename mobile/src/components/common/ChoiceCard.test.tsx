import { fireEvent, render, screen } from '@testing-library/react-native';

import { ChoiceCard } from './ChoiceCard';

describe('ChoiceCard', () => {
  it('selects on press', () => {
    const onPress = jest.fn();
    render(
      <ChoiceCard title="Relaxed" description="~15 min/day" selected={false} onPress={onPress} testID="relaxed" />,
    );

    fireEvent.press(screen.getByTestId('relaxed'));
    expect(onPress).toHaveBeenCalled();
  });

  it('marks selection with a jade border and a wash, not colour alone', () => {
    render(<ChoiceCard title="Relaxed" selected onPress={jest.fn()} testID="relaxed" />);

    const card = screen.getByTestId('relaxed');
    expect(card.props.className).toContain('border-brand-500');
    expect(card.props.className).toContain('bg-brand-soft');
    expect(card.props.accessibilityState).toMatchObject({ selected: true, checked: true });
  });

  it('falls back to a plain outlined surface when unselected', () => {
    render(<ChoiceCard title="Intense" selected={false} onPress={jest.fn()} testID="intense" />);

    const card = screen.getByTestId('intense');
    expect(card.props.className).toContain('border-border');
    expect(card.props.className).not.toContain('bg-brand-soft');
  });

  it('renders the recommendation pill when given one', () => {
    render(
      <ChoiceCard
        title="Relaxed"
        selected
        onPress={jest.fn()}
        badgeLabel="Recommended"
        testID="relaxed"
      />,
    );

    expect(screen.getByText('Recommended')).toBeTruthy();
  });

  it('reads the title and description as one label', () => {
    render(
      <ChoiceCard title="Relaxed" description="~15 min/day" selected={false} onPress={jest.fn()} />,
    );

    expect(screen.getByLabelText('Relaxed. ~15 min/day')).toBeTruthy();
  });
});

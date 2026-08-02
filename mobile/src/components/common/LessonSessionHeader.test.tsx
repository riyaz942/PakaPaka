import { fireEvent, render, screen } from '@testing-library/react-native';

import { LessonSessionHeader } from './LessonSessionHeader';

describe('LessonSessionHeader', () => {
  it('shows the position counter', () => {
    render(<LessonSessionHeader current={2} total={5} onExitPress={jest.fn()} testID="header" />);
    expect(screen.getByText('2/5')).toBeTruthy();
  });

  it('exits on the close affordance', () => {
    const onExitPress = jest.fn();
    render(
      <LessonSessionHeader current={2} total={5} onExitPress={onExitPress} testID="header" />,
    );

    fireEvent.press(screen.getByTestId('header-exit'));
    expect(onExitPress).toHaveBeenCalled();
  });

  it('fills the bar to the position and tints it with the item type', () => {
    render(
      <LessonSessionHeader
        current={2}
        total={5}
        itemType="radical"
        onExitPress={jest.fn()}
        testID="header"
      />,
    );

    const fill = screen.getByTestId('header-fill');
    expect(fill.props.style).toMatchObject({ width: '40%' });
    expect(fill.props.className).toContain('bg-content-radical');
  });

  it('announces progress as a labelled progressbar', () => {
    render(<LessonSessionHeader current={3} total={5} onExitPress={jest.fn()} />);

    const bar = screen.getByLabelText('Lesson item 3 of 5');
    expect(bar.props.accessibilityRole).toBe('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 5, now: 3 });
  });

  it('does not divide by zero on an empty lesson', () => {
    render(<LessonSessionHeader current={0} total={0} onExitPress={jest.fn()} testID="header" />);
    expect(screen.getByTestId('header-fill').props.style).toMatchObject({ width: '0%' });
  });
});

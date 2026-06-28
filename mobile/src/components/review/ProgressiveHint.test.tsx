import { fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { ProgressiveHint } from './ProgressiveHint';

jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});

describe('ProgressiveHint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const levels = [
    { content: 'Noun + です' },
    { content: 'Grammar point: copula (is/am)' },
    { content: '食べる — you learned this yesterday', isReinforcement: true },
  ];

  it('advances through levels on tap and updates button copy', () => {
    render(<ProgressiveHint levels={levels} />);

    expect(screen.getByLabelText('Hint')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Hint'));
    expect(screen.getByText('Noun + です')).toBeTruthy();
    expect(screen.getByLabelText('Hint (1/3)')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Hint (1/3)'));
    expect(screen.getByText('Grammar point: copula (is/am)')).toBeTruthy();
  });

  it('announces each reveal and remaining hints', () => {
    render(<ProgressiveHint levels={levels} />);

    fireEvent.press(screen.getByLabelText('Hint'));
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('Noun + です');
    expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith('2 hints remaining');
  });

  it('hides button when all levels are revealed', () => {
    render(<ProgressiveHint levels={levels} />);

    fireEvent.press(screen.getByLabelText('Hint'));
    fireEvent.press(screen.getByLabelText('Hint (1/3)'));
    fireEvent.press(screen.getByLabelText('Hint (2/3)'));

    expect(screen.queryByLabelText('Hint (3/3)')).toBeNull();
    expect(screen.getByText('食べる — you learned this yesterday')).toBeTruthy();
  });

  it('renders nothing when all levels are empty', () => {
    const { toJSON } = render(<ProgressiveHint levels={[]} />);
    expect(toJSON()).toBeNull();
  });

  it('calls onReveal with updated count', () => {
    const onReveal = jest.fn();
    render(<ProgressiveHint levels={levels.slice(0, 1)} onReveal={onReveal} />);

    fireEvent.press(screen.getByLabelText('Hint'));
    expect(onReveal).toHaveBeenCalledWith(1);
  });
});

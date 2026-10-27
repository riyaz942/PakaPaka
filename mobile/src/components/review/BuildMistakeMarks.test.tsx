import { fireEvent, render, screen } from '@testing-library/react-native';

import type { BuildDiagnosis } from '@/core/grammar/mistakes/mistake.types';

import { BuildMistakeMarks } from './BuildMistakeMarks';

const INPUT = '今年学校に日本語を勉強する';
const THREE: BuildDiagnosis = {
  lines: [],
  marks: [
    {
      kind: 'particle_missing', rawStart: 2, rawEnd: 2, typed: '', expected: ['は'],
      before: '今年', after: '学校',
    },
    {
      kind: 'particle_wrong', rawStart: 4, rawEnd: 5, typed: 'に', expected: ['で'],
      before: '学校', after: '日本語',
    },
    {
      kind: 'form', rawStart: 9, rawEnd: 13, typed: '勉強する', expected: ['勉強します'],
      before: 'を', after: null, dims: { register: 'polite' },
    },
  ],
};
const render3 = () =>
  render(<BuildMistakeMarks input={INPUT} diagnosis={THREE} grammarLabel="〜のに" />);

describe('BuildMistakeMarks', () => {
  it('opens the first of three marks', () => {
    render3();
    expect(screen.getByText('YOUR ANSWER — TAP A MARK')).toBeTruthy();
    expect(screen.getAllByTestId(/^build-mistake-mark-/)).toHaveLength(3);
    expect(screen.getByTestId('build-mistake-mark-0').props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('1 of 3')).toBeTruthy();
    expect(
      screen.getByText('Between 今年 and 学校, you need は. Your answer has no particle there.'),
    ).toBeTruthy();
  });

  it('shows the explanation of the tapped mark', () => {
    render3();
    fireEvent.press(screen.getByTestId('build-mistake-mark-1'));
    expect(
      screen.getByText('After 学校, you used に. This sentence needs で.'),
    ).toBeTruthy();
    expect(screen.getByText('2 of 3')).toBeTruthy();
    expect(screen.getByTestId('build-mistake-mark-1').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('build-mistake-mark-0').props.accessibilityState.selected).toBe(false);
  });

  it('shows a word order line with no mark', () => {
    render(
      <BuildMistakeMarks
        input="学校で日本語を今年は勉強します"
        diagnosis={{
          marks: [],
          lines: [{ kind: 'word_order', rawStart: 0, rawEnd: 0, typed: '', expected: [], before: null, after: null }],
        }}
        grammarLabel="〜のに"
      />,
    );
    expect(screen.getByText('YOUR ANSWER')).toBeTruthy();
    expect(screen.queryByTestId('build-mistake-mark-0')).toBeNull();
    expect(screen.getByText('All words are correct. The order is not.')).toBeTruthy();
  });

  it('shows only the raw input when there is no diagnosis', () => {
    render(<BuildMistakeMarks input={INPUT} diagnosis={null} grammarLabel="〜のに" />);
    expect(screen.getByText('YOUR ANSWER')).toBeTruthy();
    expect(screen.getByText(INPUT)).toBeTruthy();
    expect(screen.queryByTestId('build-mistake-mark-0')).toBeNull();
    expect(screen.queryByText(/ of /)).toBeNull();
  });
});

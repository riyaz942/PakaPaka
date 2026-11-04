import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { WanaKanaInput } from './WanaKanaInput';

describe('WanaKanaInput', () => {
  it('converts romaji to kana on each keystroke in kana mode', () => {
    const onChangeText = jest.fn();
    render(
      <WanaKanaInput
        mode="kana"
        value=""
        onChangeText={onChangeText}
        onSubmit={jest.fn()}
        autoFocus={false}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Answer input, type in romaji'), 'ta');
    expect(onChangeText).toHaveBeenCalledWith('た');
  });

  it('passes through text in english mode', () => {
    const onChangeText = jest.fn();
    render(
      <WanaKanaInput
        mode="english"
        value=""
        onChangeText={onChangeText}
        onSubmit={jest.fn()}
        autoFocus={false}
      />,
    );

    fireEvent.changeText(screen.getByLabelText('Answer input'), 'eat');
    expect(onChangeText).toHaveBeenCalledWith('eat');
  });

  it('has correct accessibility label in kana mode', () => {
    render(
      <WanaKanaInput
        mode="kana"
        value=""
        onChangeText={jest.fn()}
        onSubmit={jest.fn()}
        autoFocus={false}
      />,
    );
    expect(screen.getByLabelText('Answer input, type in romaji')).toBeTruthy();
  });

  it('has submitBehavior submit so hardware Enter does not blur the field', () => {
    render(
      <WanaKanaInput
        mode="english"
        value=""
        onChangeText={jest.fn()}
        onSubmit={jest.fn()}
        autoFocus={false}
      />,
    );
    expect(screen.getByLabelText('Answer input').props.submitBehavior).toBe('submit');
  });

  it('submits converted kana value on return key in kana mode', () => {
    const onSubmit = jest.fn();
    render(
      <WanaKanaInput
        mode="kana"
        value="た"
        onChangeText={jest.fn()}
        onSubmit={onSubmit}
        autoFocus={false}
      />,
    );

    fireEvent(screen.getByLabelText('Answer input, type in romaji'), 'submitEditing');
    expect(onSubmit).toHaveBeenCalled();
    expect(screen.getByLabelText('Answer input, type in romaji').props.value).toBe('た');
  });

  it('submits on return key', () => {
    const onSubmit = jest.fn();
    render(
      <WanaKanaInput
        mode="english"
        value="eat"
        onChangeText={jest.fn()}
        onSubmit={onSubmit}
        autoFocus={false}
      />,
    );

    fireEvent(screen.getByLabelText('Answer input'), 'submitEditing');
    expect(onSubmit).toHaveBeenCalled();
  });

  it('sets kana answers in the Japanese face', () => {
    render(
      <WanaKanaInput
        mode="kana"
        value="いち"
        onChangeText={jest.fn()}
        onSubmit={jest.fn()}
        autoFocus={false}
      />,
    );

    expect(screen.getByLabelText('Answer input, type in romaji').props.className).toContain(
      'font-jp-medium',
    );
  });

  it.each([
    ['correct', 'bg-feedback-correct-soft', 'text-feedback-correct-deep'],
    ['incorrect', 'bg-feedback-incorrect-soft', 'text-feedback-incorrect-deep'],
    ['near-miss', 'bg-feedback-warning-soft', 'text-feedback-warning-deep'],
    ['wrong-script', 'bg-feedback-info-soft', 'text-feedback-info-deep'],
  ] as const)('dresses the %s state in its soft fill and deep copy', (state, fill, copy) => {
    render(
      <WanaKanaInput
        mode="kana"
        value="いち"
        state={state}
        onChangeText={jest.fn()}
        onSubmit={jest.fn()}
        autoFocus={false}
        testID="answer"
      />,
    );

    expect(screen.getByTestId('answer-field').props.className).toContain(fill);
    expect(screen.getByTestId('answer').props.className).toContain(copy);
  });

  it('marks correct with a check and incorrect with a cross', () => {
    const { rerender } = render(
      <WanaKanaInput
        mode="kana"
        value="いち"
        state="correct"
        onChangeText={jest.fn()}
        onSubmit={jest.fn()}
        autoFocus={false}
        testID="answer"
      />,
    );
    expect(screen.getByTestId('answer-mark', { includeHiddenElements: true })).toBeTruthy();

    rerender(
      <WanaKanaInput
        mode="kana"
        value="しち"
        state="near-miss"
        onChangeText={jest.fn()}
        onSubmit={jest.fn()}
        autoFocus={false}
        testID="answer"
      />,
    );
    // Near-miss and wrong-script explain themselves in words, not a mark.
    expect(screen.queryByTestId('answer-mark', { includeHiddenElements: true })).toBeNull();
  });

  it('shows the explanation line for the states that carry one', () => {
    render(
      <WanaKanaInput
        mode="kana"
        value="ひと"
        state="near-miss"
        hint="Almost — that's a reading, we want the meaning."
        onChangeText={jest.fn()}
        onSubmit={jest.fn()}
        autoFocus={false}
        testID="answer"
      />,
    );

    expect(screen.getByTestId('answer-hint')).toHaveTextContent(
      "Almost — that's a reading, we want the meaning.",
    );
  });

  it('shows the jade focus halo only while an unanswered field has focus', () => {
    render(
      <WanaKanaInput
        mode="english"
        value=""
        onChangeText={jest.fn()}
        onSubmit={jest.fn()}
        autoFocus={false}
        testID="answer"
      />,
    );

    expect(screen.queryByTestId('answer-focus-halo')).toBeNull();

    fireEvent(screen.getByLabelText('Answer input'), 'focus');
    expect(screen.getByTestId('answer-focus-halo')).toBeTruthy();
    expect(screen.getByTestId('answer-field').props.className).toContain('border-brand-500');

    fireEvent(screen.getByLabelText('Answer input'), 'blur');
    expect(screen.queryByTestId('answer-focus-halo')).toBeNull();
  });

  it('keeps the verdict chrome when an answered field has focus', () => {
    render(
      <WanaKanaInput
        mode="english"
        value="one"
        state="correct"
        onChangeText={jest.fn()}
        onSubmit={jest.fn()}
        autoFocus={false}
        testID="answer"
      />,
    );

    fireEvent(screen.getByLabelText('Answer input'), 'focus');
    expect(screen.queryByTestId('answer-focus-halo')).toBeNull();
    expect(screen.getByTestId('answer-field').props.className).toContain(
      'bg-feedback-correct-soft',
    );
  });

  it('respects disabled state', () => {
    render(
      <WanaKanaInput
        mode="english"
        value=""
        onChangeText={jest.fn()}
        onSubmit={jest.fn()}
        editable={false}
        autoFocus={false}
      />,
    );
    expect(screen.getByLabelText('Answer input').props.editable).toBe(false);
  });

  describe('keeping focus after Return, so a second Return can advance the card', () => {
    afterEach(() => {
      Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    });

    function renderInput() {
      render(
        <WanaKanaInput
          mode="english"
          value=""
          onChangeText={jest.fn()}
          onSubmit={jest.fn()}
          autoFocus={false}
        />,
      );
      return screen.getByLabelText('Answer input');
    }

    it('on web, stops react-native-web from blurring the field on submit', () => {
      Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
      expect(renderInput().props.blurOnSubmit).toBe(false);
    });

    it('on native, leaves submit behaviour to submitBehavior alone', () => {
      expect(renderInput().props.blurOnSubmit).toBeUndefined();
    });
  });
});

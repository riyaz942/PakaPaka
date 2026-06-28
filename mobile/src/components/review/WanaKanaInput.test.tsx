import { fireEvent, render, screen } from '@testing-library/react-native';

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
});

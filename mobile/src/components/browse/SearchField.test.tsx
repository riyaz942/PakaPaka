import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { SearchField } from '@/components/browse/SearchField';

describe('SearchField', () => {
  it('reports typed text without submitting', () => {
    const onChangeText = jest.fn();
    const onSubmit = jest.fn();
    const onClear = jest.fn();
    render(
      <SearchField
        value=""
        onChangeText={onChangeText}
        onSubmit={onSubmit}
        onClear={onClear}
        testID="browse-search"
      />,
    );

    fireEvent.changeText(screen.getByTestId('browse-search'), 'mizu');

    expect(onChangeText).toHaveBeenCalledWith('mizu');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits on the search button, and on the keyboard submit key', () => {
    const onSubmit = jest.fn();
    render(
      <SearchField
        value="mizu"
        onChangeText={jest.fn()}
        onSubmit={onSubmit}
        onClear={jest.fn()}
        testID="browse-search"
      />,
    );

    fireEvent.press(screen.getByTestId('browse-search-submit'));
    expect(onSubmit).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByTestId('browse-search'), 'submitEditing');
    expect(onSubmit).toHaveBeenCalledTimes(2);
  });

  it('shows Clear only once there is text, and wires it to onClear', () => {
    const onClear = jest.fn();
    const { rerender } = render(
      <SearchField
        value=""
        onChangeText={jest.fn()}
        onSubmit={jest.fn()}
        onClear={onClear}
        testID="browse-search"
      />,
    );

    expect(screen.queryByTestId('browse-search-clear')).toBeNull();

    rerender(
      <SearchField
        value="mizu"
        onChangeText={jest.fn()}
        onSubmit={jest.fn()}
        onClear={onClear}
        testID="browse-search"
      />,
    );

    fireEvent.press(screen.getByTestId('browse-search-clear'));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

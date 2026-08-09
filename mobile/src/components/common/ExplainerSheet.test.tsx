import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';
import { Text } from 'react-native';

import { ExplainerSheet } from '@/components/common/ExplainerSheet';

describe('ExplainerSheet', () => {
  it('renders an explainer topic with its authored title and paragraphs', () => {
    const onDismiss = jest.fn();
    render(<ExplainerSheet topic="burned" visible onDismiss={onDismiss} />);

    expect(screen.getByText('Burned')).toBeTruthy();
    expect(screen.getByText(/Burned is the last SRS stage/)).toBeTruthy();
    expect(screen.getByText(/Burned does not mean forgotten-proof/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('explainer-sheet-close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('renders a caller-supplied title and body in the same chrome', () => {
    const onDismiss = jest.fn();
    render(
      <ExplainerSheet title="Why kanji ask twice" visible onDismiss={onDismiss}>
        <Text>Meaning card and reading card.</Text>
      </ExplainerSheet>,
    );

    expect(screen.getByText('Why kanji ask twice')).toBeTruthy();
    expect(screen.getByText('Meaning card and reading card.')).toBeTruthy();
    expect(screen.getByTestId('explainer-sheet')).toBeTruthy();

    fireEvent.press(screen.getByTestId('explainer-sheet-close'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('labels its close control with the title in both modes', () => {
    const { rerender } = render(
      <ExplainerSheet topic="radical" visible onDismiss={jest.fn()} />,
    );
    expect(screen.getByTestId('explainer-sheet-close').props.accessibilityLabel).toBe(
      'Close Radicals explainer',
    );

    rerender(
      <ExplainerSheet title="Where the readings went" visible onDismiss={jest.fn()}>
        <Text>Body.</Text>
      </ExplainerSheet>,
    );
    expect(screen.getByTestId('explainer-sheet-close').props.accessibilityLabel).toBe(
      'Close Where the readings went explainer',
    );
  });
});

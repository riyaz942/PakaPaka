import { render, screen } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ConverseScreen from './index';

describe('ConverseScreen', () => {
  it('is a calm placeholder that promises conversation without offering any chat surface', () => {
    render(
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 390, height: 844 },
          insets: { top: 0, left: 0, right: 0, bottom: 0 },
        }}>
        <ConverseScreen />
      </SafeAreaProvider>,
    );

    expect(screen.getByText('Conversation coming soon')).toBeTruthy();
    // Epic 5 owns chat and BYOK key setup — this tab must not hint at either yet.
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByLabelText(/api key/i)).toBeNull();
  });
});

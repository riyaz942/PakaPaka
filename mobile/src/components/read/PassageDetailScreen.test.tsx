import { fireEvent, render } from '@testing-library/react-native';
import React from 'react';
import { Platform, TextInput } from 'react-native';

import { PassageDetailScreen } from './PassageDetailScreen';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useLocalSearchParams: () => ({ id: '31' }),
}));

jest.mock('@/components/common/ScreenHeader', () => ({
  ScreenHeader: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('@/components/read/PassageReader', () => ({ PassageReader: () => null }));
jest.mock('@/components/read/PassageLockedTodo', () => ({ PassageLockedTodo: () => null }));

jest.mock('@/data/hooks/usePassageDetail', () => ({
  usePassageDetail: () => ({
    passage: { id: '31', title: 'Passage' },
    questions: [],
    practiceResults: [],
    wordSpans: [],
    unlock: null,
    isUnlocked: true,
    neededItems: [],
    recentWord: null,
    loading: false,
    notFound: false,
  }),
}));

describe('PassageDetailScreen on web', () => {
  const originalOS = Platform.OS;
  const originalState = TextInput.State;

  beforeEach(() => {
    Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
    // react-native-web's TextInput.State has currentlyFocusedField only.
    (TextInput as unknown as { State: object }).State = {
      currentlyFocusedField: () => null,
    };
  });

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalOS, configurable: true });
    (TextInput as unknown as { State: object }).State = originalState;
  });

  it('lays out the passage without calling the native-only focused-input API', () => {
    const { UNSAFE_getByType } = render(<PassageDetailScreen />);
    const { ScrollView } = jest.requireActual('react-native');

    expect(() => fireEvent(UNSAFE_getByType(ScrollView), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 600 } },
    })).not.toThrow();
  });
});

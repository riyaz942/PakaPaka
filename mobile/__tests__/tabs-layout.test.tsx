import { render, screen } from '@testing-library/react-native';
import React from 'react';

jest.mock('expo-router', () => {
  const ReactLib = require('react');
  const { Text, View } = require('react-native');

  function Tabs({ children }: { children: unknown }) {
    return ReactLib.createElement(View, null, children);
  }

  Tabs.Screen = function TabScreen({
    name,
    options,
  }: {
    name: string;
    options?: { title?: string; href?: null };
  }) {
    // `href: null` is how Expo Router keeps a route reachable (for redirects)
    // while removing it from the tab bar.
    const label = options?.href === null ? 'hidden' : (options?.title ?? name);
    return ReactLib.createElement(Text, { testID: `tab-${name}` }, label);
  };

  return { Tabs };
});

// Lives in __tests__/ rather than beside the layout on purpose: Expo Router
// treats *any* `_layout.*` file in a route directory as a layout, so a
// `_layout.test.tsx` sibling silently drops the whole group from route
// generation.
import TabsLayout from '@/app/(tabs)/_layout';

describe('(tabs)/_layout', () => {
  it('renders the five visible tabs in order: Home, Browse, Talk, Stats, Settings', () => {
    render(<TabsLayout />);

    expect(screen.getByTestId('tab-dashboard')).toHaveTextContent('Home');
    expect(screen.getByTestId('tab-browse')).toHaveTextContent('Browse');
    expect(screen.getByTestId('tab-converse')).toHaveTextContent('Talk');
    expect(screen.getByTestId('tab-stats')).toHaveTextContent('Stats');
    expect(screen.getByTestId('tab-settings')).toHaveTextContent('Settings');
  });

  it('no longer exposes a Read tab and keeps learn/read reachable only as redirects', () => {
    render(<TabsLayout />);

    expect(screen.getByTestId('tab-learn')).toHaveTextContent('hidden');
    expect(screen.getByTestId('tab-read')).toHaveTextContent('hidden');
    expect(screen.queryByText('Read')).toBeNull();
    expect(screen.queryByText('Learn')).toBeNull();
  });
});

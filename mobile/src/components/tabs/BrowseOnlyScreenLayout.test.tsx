import { act, fireEvent, screen } from '@testing-library/react-native';
import { router, Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Tabs, TabList, TabSlot, TabTrigger } from 'expo-router/ui';
import React from 'react';
import { Text } from 'react-native';

import SettingsTabLayout from '@/app/(tabs)/settings/_layout';
import { browseOnlyRootScreenLayout } from '@/components/tabs/BrowseOnlyScreenLayout';
import { TabModeContext } from '@/providers/TabModeContext';

// The blocked screen must replace the screen, not the navigator: with the
// Stack swapped out, expo-router drops the navigation and the push is lost.
function renderApp(browseOnly: boolean, initialUrl = '/') {
  const useHere = jest.fn();
  function Layout() {
    return (
      <TabModeContext.Provider value={{ browseOnly, useHere }}>
        <Stack screenLayout={browseOnlyRootScreenLayout} />
      </TabModeContext.Provider>
    );
  }
  const result = renderRouter(
    {
      _layout: Layout,
      index: () => <Text>home screen</Text>,
      browse: () => <Text>browse screen</Text>,
      review: () => <Text>review screen</Text>,
      '(tabs)/_layout': () => (
        <Tabs>
          <TabList>
            <TabTrigger name="dashboard" href="/dashboard">
              <Text>tab bar</Text>
            </TabTrigger>
            <TabTrigger name="settings" href="/settings">
              <Text>settings tab</Text>
            </TabTrigger>
          </TabList>
          <TabSlot />
        </Tabs>
      ),
      '(tabs)/dashboard': () => <Text>dashboard screen</Text>,
      '(tabs)/settings/_layout': SettingsTabLayout,
      '(tabs)/settings/index': () => <Text>settings screen</Text>,
      '(tabs)/settings/home-layout': () => <Text>home layout screen</Text>,
      '(tabs)/settings/about': () => <Text>about screen</Text>,
    },
    { initialUrl },
  );
  return { useHere, getPathname: () => result.getPathname() };
}

describe('BrowseOnlyScreenLayout inside the router', () => {
  it('a push to a blocked route shows the blocked screen and keeps the path', () => {
    const app = renderApp(true);
    expect(screen.getByText('home screen')).toBeTruthy();

    act(() => router.push('/review'));

    expect(screen.getByText('Reviews and lessons run in the other tab')).toBeTruthy();
    expect(app.getPathname()).toBe('/review');
    expect(screen.queryByText('review screen')).toBeNull();
  });

  it('Back to Browse navigates to /browse', () => {
    const app = renderApp(true);
    act(() => router.push('/review'));

    fireEvent.press(screen.getByRole('button', { name: 'Back to Browse' }));

    expect(app.getPathname()).toBe('/browse');
    expect(screen.getByText('browse screen')).toBeTruthy();
    expect(screen.queryByText('Reviews and lessons run in the other tab')).toBeNull();
  });

  it('a deep link to a blocked route shows the blocked screen', () => {
    renderApp(true, '/settings/about');

    expect(screen.getByText('Reviews and lessons run in the other tab')).toBeTruthy();
    expect(screen.queryByText('about screen')).toBeNull();
  });

  // The tab group holds a navigator; replacing it unmounts the tab navigator,
  // and in the browser the router then lands on another tab.
  it('a tab section is blocked inside its own layout and the tab navigator stays', () => {
    const app = renderApp(true, '/dashboard');

    act(() => router.push('/settings'));

    expect(screen.getByText('Reviews and lessons run in the other tab')).toBeTruthy();
    expect(screen.getByText('tab bar')).toBeTruthy();
    expect(screen.queryByText('settings screen')).toBeNull();
    expect(app.getPathname()).toBe('/settings');
  });

  it('renders every route when the tab is not browse-only', () => {
    renderApp(false);

    act(() => router.push('/review'));

    expect(screen.getByText('review screen')).toBeTruthy();
    expect(screen.queryByText('Reviews and lessons run in the other tab')).toBeNull();

    act(() => router.push('/settings'));
    expect(screen.getByText('settings screen')).toBeTruthy();
  });
});

import { render } from '@testing-library/react-native';
import React from 'react';

import { Icon, type IconName } from './Icon';

const ALL_ICONS: IconName[] = [
  'home',
  'search',
  'talk',
  'stats',
  'settings',
  'review',
  'lesson',
  'passage',
  'weakness',
  'streak',
  'days',
  'filter',
  'mic',
  'send',
  'history',
  'locked',
  'correct',
  'close',
  'back',
  'import',
  'info',
  'chevron',
  'device',
  'image',
  'offline',
];

describe('Icon', () => {
  it('renders every name in the set', () => {
    for (const name of ALL_ICONS) {
      const { getByTestId, unmount } = render(<Icon name={name} testID={`icon-${name}`} />);
      expect(getByTestId(`icon-${name}`, { includeHiddenElements: true })).toBeTruthy();
      unmount();
    }
  });

  it('draws on the spec 24px grid with a 1.75 round-capped stroke', () => {
    const { getByTestId } = render(<Icon name="home" testID="icon" />);
    const svg = getByTestId('icon', { includeHiddenElements: true });

    expect(svg.props.vbWidth).toBe(24);
    expect(svg.props.vbHeight).toBe(24);
    expect(svg.props.strokeWidth).toBe(1.75);
    expect(svg.props.strokeLinecap).toBe('round');
    expect(svg.props.strokeLinejoin).toBe('round');
  });

  it('takes its colour from a token class, never a raw hex prop', () => {
    const { getByTestId } = render(
      <Icon name="review" className="text-brand-500" testID="icon" />,
    );

    // `currentColor` resolves against the SVG's `color`, which the token class
    // supplies through cssInterop — so no hex ever reaches an SVG prop.
    expect(getByTestId('icon', { includeHiddenElements: true }).props.stroke).toBe(
      'currentColor',
    );
  });

  it('is hidden from screen readers — icons always sit beside a label', () => {
    const { getByTestId } = render(<Icon name="close" testID="icon" />);
    expect(getByTestId('icon', { includeHiddenElements: true }).props.accessibilityElementsHidden).toBe(true);
  });
});

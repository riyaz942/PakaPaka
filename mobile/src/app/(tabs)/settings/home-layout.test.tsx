import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { State } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { serializeHomeLayout, type HomeSectionEntry } from '@/core/engagement/homeLayout';

import HomeLayoutScreen from './home-layout';

const mockUserDb = {};

jest.mock('@/data/hooks/useDatabase', () => ({
  useDatabase: () => ({ userDb: mockUserDb }),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({
    reducedMotion: false,
    preference: null,
    setReducedMotion: jest.fn(),
    refetch: jest.fn(),
  }),
}));

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  router: {
    back: (...args: unknown[]) => mockBack(...args),
  },
}));

// Raw stored value, same shape as the `home_layout` preference row. Routed
// through the real reconciler so tests exercise the actual reconciliation
// guarantees rather than a re-implementation of them.
let mockHomeLayoutStored: string | null = null;
const mockSetHomeLayout = jest.fn();

jest.mock('@/data/user/preferencesRepository', () => ({
  getHomeLayout: () => {
    const { reconcileHomeLayout } = jest.requireActual('@/core/engagement/homeLayout');
    return reconcileHomeLayout(mockHomeLayoutStored);
  },
  // Indirected: jest.mock factories run before module-scope consts are
  // initialised, so the mock references mockSetHomeLayout lazily.
  setHomeLayout: (db: unknown, entries: HomeSectionEntry[]) => mockSetHomeLayout(db, entries),
}));

function lastPersistedEntries(): HomeSectionEntry[] {
  const call = mockSetHomeLayout.mock.calls[mockSetHomeLayout.mock.calls.length - 1];
  return call[1];
}

function renderOrder(): string[] {
  const dump = JSON.stringify(screen.toJSON());
  const ids = [
    'goal-ring',
    'review-cta',
    'lesson-cta',
    'level-progress',
    'review-forecast',
    'reading-readiness',
    'at-risk',
  ];
  return ids
    .map((id) => ({ id, position: dump.indexOf(`"home-layout-row-${id}"`) }))
    .filter((entry) => entry.position >= 0)
    .sort((a, b) => a.position - b.position)
    .map((entry) => entry.id);
}

/** Drags a row down/up by whole tile heights via the gesture, then releases. */
function dragRow(id: string, deltaRows: number) {
  const translationY = deltaRows * 140;
  act(() => {
    fireGestureHandler(getByGestureTestId(`home-layout-row-pan-${id}`), [
      { state: State.BEGAN, translationY: 0 },
      { state: State.ACTIVE, translationY: translationY / 2 },
      { state: State.ACTIVE, translationY },
      { state: State.END, translationY, velocityY: 0 },
    ]);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockHomeLayoutStored = null;
});

describe('HomeLayoutScreen', () => {
  it('renders all seven catalog sections in default order', () => {
    render(<HomeLayoutScreen />);

    expect(renderOrder()).toEqual([
      'goal-ring',
      'review-cta',
      'lesson-cta',
      'level-progress',
      'review-forecast',
      'reading-readiness',
      'at-risk',
    ]);
  });

  it('shows a lock icon instead of a hide toggle on required sections', () => {
    render(<HomeLayoutScreen />);

    expect(screen.queryByTestId('home-layout-row-visibility-review-cta')).toBeNull();
    expect(screen.queryByTestId('home-layout-row-visibility-lesson-cta')).toBeNull();
    expect(
      screen.getByTestId('home-layout-row-lock-review-cta', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(
      screen.getByTestId('home-layout-row-lock-lesson-cta', { includeHiddenElements: true }),
    ).toBeTruthy();

    // Optional sections keep the hide toggle, not a lock.
    expect(screen.getByTestId('home-layout-row-visibility-at-risk')).toBeTruthy();
    expect(
      screen.queryByTestId('home-layout-row-lock-at-risk', { includeHiddenElements: true }),
    ).toBeNull();
  });

  it('hides a section via the eye toggle and persists the change', () => {
    render(<HomeLayoutScreen />);

    fireEvent.press(screen.getByTestId('home-layout-row-visibility-at-risk'));

    expect(screen.getByTestId('home-layout-row-at-risk')).toBeTruthy();
    const atRisk = lastPersistedEntries().find((entry) => entry.id === 'at-risk');
    expect(atRisk?.visible).toBe(false);
  });

  it('a11y move-down action reorders a row and persists the new order', () => {
    render(<HomeLayoutScreen />);

    fireEvent(screen.getByTestId('home-layout-row-goal-ring'), 'accessibilityAction', {
      nativeEvent: { actionName: 'moveDown' },
    });

    expect(renderOrder()).toEqual([
      'review-cta',
      'goal-ring',
      'lesson-cta',
      'level-progress',
      'review-forecast',
      'reading-readiness',
      'at-risk',
    ]);
    expect(lastPersistedEntries().map((entry) => entry.id)).toEqual([
      'review-cta',
      'goal-ring',
      'lesson-cta',
      'level-progress',
      'review-forecast',
      'reading-readiness',
      'at-risk',
    ]);
  });

  it('a11y show/hide action is absent for required sections', () => {
    render(<HomeLayoutScreen />);

    expect(screen.getByTestId('home-layout-row-review-cta').props.accessibilityActions).toEqual([
      { name: 'moveUp', label: 'Move up' },
      { name: 'moveDown', label: 'Move down' },
    ]);
    expect(screen.getByTestId('home-layout-row-at-risk').props.accessibilityActions).toEqual([
      { name: 'moveUp', label: 'Move up' },
      { name: 'moveDown', label: 'Move down' },
      { name: 'toggleVisibility', label: 'Hide' },
    ]);
  });

  it('drags a row down one slot and persists the new order', () => {
    render(<HomeLayoutScreen />);

    dragRow('goal-ring', 1);

    expect(renderOrder()).toEqual([
      'review-cta',
      'goal-ring',
      'lesson-cta',
      'level-progress',
      'review-forecast',
      'reading-readiness',
      'at-risk',
    ]);
    expect(lastPersistedEntries().map((entry) => entry.id)).toEqual([
      'review-cta',
      'goal-ring',
      'lesson-cta',
      'level-progress',
      'review-forecast',
      'reading-readiness',
      'at-risk',
    ]);
  });

  it('clamps a drag past the top of the list instead of dropping the row', () => {
    render(<HomeLayoutScreen />);

    dragRow('goal-ring', -3);

    // goal-ring is already first — an out-of-range drag is a no-op.
    expect(renderOrder()[0]).toBe('goal-ring');
    expect(mockSetHomeLayout).not.toHaveBeenCalled();
  });

  it('restores default order and visibility on reset', () => {
    mockHomeLayoutStored = serializeHomeLayout([
      { id: 'at-risk', visible: true },
      { id: 'goal-ring', visible: false },
      { id: 'review-cta', visible: true },
      { id: 'lesson-cta', visible: true },
      { id: 'level-progress', visible: true },
      { id: 'review-forecast', visible: true },
      { id: 'reading-readiness', visible: true },
    ]);

    render(<HomeLayoutScreen />);
    expect(renderOrder()[0]).toBe('at-risk');

    fireEvent.press(screen.getByTestId('home-layout-reset-button'));

    expect(renderOrder()).toEqual([
      'goal-ring',
      'review-cta',
      'lesson-cta',
      'level-progress',
      'review-forecast',
      'reading-readiness',
      'at-risk',
    ]);
    expect(lastPersistedEntries().every((entry) => entry.visible)).toBe(true);
  });

  it('navigates back to Settings via the header back button', () => {
    render(<HomeLayoutScreen />);

    fireEvent.press(screen.getByTestId('home-layout-back'));

    expect(mockBack).toHaveBeenCalled();
  });
});

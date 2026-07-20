import { render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';

import { buildShareMessage, PostSessionShareCard } from './PostSessionShareCard';

jest.spyOn(Share, 'share').mockImplementation(jest.fn());

const BASE_PROPS = {
  domainCounts: { radical: 0, kanji: 8, vocabulary: 5, grammar: 2 },
  actualMinutes: 18,
  sessionDate: new Date('2026-06-29T12:00:00.000Z'),
};

describe('PostSessionShareCard', () => {
  it('renders branding and stats without any streak row', () => {
    render(<PostSessionShareCard {...BASE_PROPS} />);

    expect(screen.getByText('Japanese Learning')).toBeTruthy();
    expect(screen.getByText('Kanji 8 · Grammar 2 · Vocab 5')).toBeTruthy();
    expect(screen.getByText('18 min studied')).toBeTruthy();
    expect(screen.queryByText(/day streak/)).toBeNull();
  });

  it('omits the multi-app line when there are no savings to claim', () => {
    render(<PostSessionShareCard {...BASE_PROPS} />);
    expect(screen.queryByText(/separate apps/)).toBeNull();
  });

  it('renders the compression claim and goal line when provided (FR33b, no streak)', () => {
    render(
      <PostSessionShareCard
        {...BASE_PROPS}
        estimatedMinutes={42}
        goalLine="Goal met — +20% overshoot"
      />,
    );

    expect(screen.getByText('~42 min in separate apps')).toBeTruthy();
    expect(screen.getByText('Goal met — +20% overshoot')).toBeTruthy();
    expect(screen.queryByText(/day streak/)).toBeNull();
  });
});

describe('buildShareMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds a message containing domain counts and minutes', () => {
    const message = buildShareMessage(BASE_PROPS);

    expect(message).toContain('Kanji: 8');
    expect(message).toContain('18 min studied');
    expect(message).not.toContain('day streak');
  });

  it('includes the compression claim and goal line when provided', () => {
    const message = buildShareMessage({
      ...BASE_PROPS,
      estimatedMinutes: 42,
      goalLine: 'Goal met',
    });

    expect(message).toContain('18 min studied (~42 min in separate apps)');
    expect(message).toContain('Goal met');
    expect(message).not.toContain('day streak');
  });

  it('swallows rejected share without throwing', async () => {
    (Share.share as jest.Mock).mockRejectedValueOnce(new Error('dismissed'));

    await expect(
      Share.share({ message: buildShareMessage(BASE_PROPS) }).catch(() => undefined),
    ).resolves.toBeUndefined();
  });
});

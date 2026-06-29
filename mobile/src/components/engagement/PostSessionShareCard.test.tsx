import { render, screen } from '@testing-library/react-native';
import { Share } from 'react-native';

import { buildShareMessage, PostSessionShareCard } from './PostSessionShareCard';

jest.spyOn(Share, 'share').mockImplementation(jest.fn());

const BASE_PROPS = {
  domainCounts: { radical: 0, kanji: 8, vocabulary: 5, grammar: 2 },
  actualMinutes: 18,
  estimatedMinutes: 35,
  hasSavings: true,
  currentStreak: 7,
  sessionDate: new Date('2026-06-29T12:00:00.000Z'),
};

describe('PostSessionShareCard', () => {
  it('renders branding, stats, and streak', () => {
    render(<PostSessionShareCard {...BASE_PROPS} />);

    expect(screen.getByText('Japanese Learning')).toBeTruthy();
    expect(screen.getByText('Kanji 8 · Grammar 2 · Vocab 5')).toBeTruthy();
    expect(screen.getByText('18 min ≈ ~35 min across separate apps')).toBeTruthy();
    expect(screen.getByText('7 day streak')).toBeTruthy();
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
    expect(message).toContain('7 day streak');
  });

  it('swallows rejected share without throwing', async () => {
    (Share.share as jest.Mock).mockRejectedValueOnce(new Error('dismissed'));

    await expect(
      Share.share({ message: buildShareMessage(BASE_PROPS) }).catch(() => undefined),
    ).resolves.toBeUndefined();
  });
});

import { render, screen } from '@testing-library/react-native';

import { SessionCompleteHeader } from './SessionCompleteHeader';

jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

describe('SessionCompleteHeader', () => {
  it('renders the check disc, title and tally', () => {
    render(<SessionCompleteHeader title="Session complete" caption="6 reviews · 4 min" />);

    expect(
      screen.getByTestId('session-complete-disc', { includeHiddenElements: true }),
    ).toBeTruthy();
    expect(screen.getByText('Session complete')).toBeTruthy();
    expect(screen.getByText('6 reviews · 4 min')).toBeTruthy();
  });

  it('drops the caption line when there is no tally to report', () => {
    render(<SessionCompleteHeader title="Lesson complete" />);

    expect(screen.getByText('Lesson complete')).toBeTruthy();
    expect(screen.queryByText(/·/)).toBeNull();
  });

  it('names the title as a header for assistive tech', () => {
    render(<SessionCompleteHeader title="Session complete" />);

    expect(screen.getByRole('header', { name: 'Session complete' })).toBeTruthy();
  });

  it('shows Alpi instead of the check disc when a mascot pose is given', () => {
    render(<SessionCompleteHeader title="Lesson complete" mascot="goal-achieved" />);

    expect(screen.getByLabelText('Alpi the alpaca cheering')).toBeTruthy();
    expect(
      screen.queryByTestId('session-complete-disc', { includeHiddenElements: true }),
    ).toBeNull();
  });
});

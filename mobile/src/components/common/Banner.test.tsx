import { act, render, screen } from '@testing-library/react-native';

import { Banner } from './Banner';

describe('Banner', () => {
  it('renders nothing when not visible', () => {
    render(<Banner message="Curriculum updated" visible={false} testID="banner" />);
    expect(screen.queryByTestId('banner')).toBeNull();
  });

  it('carries the jade wash and jade copy for guidance', () => {
    render(<Banner message="Import in Settings." visible variant="info" testID="banner" />);

    expect(screen.getByTestId('banner').props.className).toContain('bg-brand-soft');
    expect(screen.getByText('Import in Settings.').props.className).toContain('text-brand-text');
  });

  it('pairs each feedback variant with its soft fill and deep copy', () => {
    render(<Banner message="Vacation mode is on." visible variant="warning" testID="banner" />);

    expect(screen.getByTestId('banner').props.className).toContain('bg-feedback-warning-soft');
    expect(screen.getByText('Vacation mode is on.').props.className).toContain(
      'text-feedback-warning-deep',
    );
  });

  it('announces itself as an alert', () => {
    render(<Banner message="Curriculum updated" visible testID="banner" />);
    expect(screen.getByTestId('banner').props.accessibilityRole).toBe('alert');
  });

  it('auto-dismisses after the given delay', () => {
    jest.useFakeTimers();
    const onDismiss = jest.fn();
    render(
      <Banner message="Curriculum updated" visible autoDismissMs={3000} onDismiss={onDismiss} />,
    );

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(onDismiss).toHaveBeenCalled();
    jest.useRealTimers();
  });
});

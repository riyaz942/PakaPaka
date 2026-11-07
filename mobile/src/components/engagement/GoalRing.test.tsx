import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { GoalRing } from './GoalRing';

jest.mock('@/data/hooks/useHaptics', () => ({
  useHaptics: () => ({ play: jest.fn() }),
  useHapticsPreference: () => ({
    hapticsEnabled: true,
    setHapticsEnabled: jest.fn(),
    refetch: jest.fn(),
  }),
}));

// Reduced motion draws the rings and bars at their final value at once.
jest.mock('@/data/hooks/useReducedMotion', () => ({
  useReducedMotion: () => ({ reducedMotion: true }),
}));

describe('GoalRing', () => {
  it('has progressbar accessibility role prop', () => {
    const { UNSAFE_getByProps } = render(<GoalRing variant="small" percent={0} />);
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(el).toBeTruthy();
  });

  it('announces goal percent by default', () => {
    render(<GoalRing variant="hero" percent={42} />);
    expect(screen.getByLabelText('Goal 42 percent')).toBeTruthy();
  });

  it('shows percent label matching the prop', () => {
    render(<GoalRing variant="small" percent={42} />);
    expect(screen.getByText('42%')).toBeTruthy();
  });

  it('uses custom accessibilityLabel when provided', () => {
    render(<GoalRing variant="small" percent={0} accessibilityLabel="Custom label" />);
    expect(screen.getByLabelText('Custom label')).toBeTruthy();
  });

  it('renders hero variant at 160px', () => {
    const { UNSAFE_getByProps } = render(<GoalRing variant="hero" percent={42} />);
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(StyleSheet.flatten(el.props.style)).toMatchObject({ width: 160, height: 160 });
  });

  it('sweeps the arc in proportion to the percent, on a full-circle track', () => {
    const { UNSAFE_getByProps } = render(<GoalRing variant="hero" percent={50} />);
    const arc = UNSAFE_getByProps({ testID: 'ring-arc' });

    const radius = (160 - Math.round(160 * 0.115)) / 2;
    const circumference = 2 * Math.PI * radius;
    expect(arc.props.strokeDasharray).toBe(`${circumference} ${circumference}`);
    expect(arc.props.animatedProps.strokeDashoffset).toBeCloseTo(circumference / 2);
  });

  it('clamps the drawn arc at a full circle while overshooting', () => {
    const { UNSAFE_getByProps } = render(<GoalRing variant="hero" percent={180} />);
    const arc = UNSAFE_getByProps({ testID: 'ring-arc' });

    const radius = (160 - Math.round(160 * 0.115)) / 2;
    const circumference = 2 * Math.PI * radius;
    expect(arc.props.strokeDasharray).toBe(`${circumference} ${circumference}`);
    expect(arc.props.animatedProps.strokeDashoffset).toBeCloseTo(0);
  });

  it('shows raw overshoot percent with an uncapped a11y value', () => {
    const { UNSAFE_getByProps } = render(<GoalRing variant="hero" percent={120} />);
    expect(screen.getByText('120%')).toBeTruthy();
    expect(screen.getByLabelText('Goal 120 percent')).toBeTruthy();
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(el.props.accessibilityValue).toEqual({ min: 0, max: 120, now: 120 });
  });

  it('caps a11y max at 100 when not overshooting', () => {
    const { UNSAFE_getByProps } = render(<GoalRing variant="hero" percent={60} />);
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(el.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 60 });
  });

  it('celebrates a beaten goal with a jade halo and a BEATEN kicker', () => {
    render(<GoalRing variant="hero" percent={124} />);
    expect(screen.getByTestId('goal-ring-halo')).toBeTruthy();
    expect(screen.getByText('Beaten')).toBeTruthy();
  });

  it('omits the BEATEN kicker on the small session variant, keeping the halo', () => {
    render(<GoalRing variant="small" percent={150} />);
    expect(screen.getByText('150%')).toBeTruthy();
    expect(screen.getByTestId('goal-ring-halo')).toBeTruthy();
    expect(screen.queryByText('Beaten')).toBeNull();
  });

  it('shows the beaten state at exactly 100%', () => {
    render(<GoalRing variant="hero" percent={100} />);
    expect(screen.getByTestId('goal-ring-halo')).toBeTruthy();
  });

  it('shows no halo below the goal', () => {
    render(<GoalRing variant="hero" percent={99} />);
    expect(screen.queryByTestId('goal-ring-halo')).toBeNull();
  });
});

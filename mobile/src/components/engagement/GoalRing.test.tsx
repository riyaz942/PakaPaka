import { render, screen } from '@testing-library/react-native';

import { GoalRing, ringBandClasses } from './GoalRing';

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

  it('renders hero variant at 160px with a thicker border', () => {
    const { UNSAFE_getByProps } = render(<GoalRing variant="hero" percent={42} />);
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(el.props.style).toEqual({ width: 160, height: 160 });
    expect(el.props.className).toContain('border-4');
  });

  it('shows raw overshoot percent with a +N% badge and uncapped a11y value', () => {
    const { UNSAFE_getByProps } = render(<GoalRing variant="hero" percent={120} />);
    expect(screen.getByText('120%')).toBeTruthy();
    expect(screen.getByText('+20%')).toBeTruthy();
    expect(screen.getByLabelText('Goal 120 percent')).toBeTruthy();
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(el.props.accessibilityValue).toEqual({ min: 0, max: 120, now: 120 });
  });

  it('caps a11y max at 100 when not overshooting', () => {
    const { UNSAFE_getByProps } = render(<GoalRing variant="hero" percent={60} />);
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(el.props.accessibilityValue).toEqual({ min: 0, max: 100, now: 60 });
  });

  it('omits the overshoot badge on the small session variant', () => {
    render(<GoalRing variant="small" percent={150} />);
    expect(screen.getByText('150%')).toBeTruthy();
    expect(screen.queryByTestId('goal-ring-overshoot-badge')).toBeNull();
  });

  it('shows no badge at exactly 100%', () => {
    render(<GoalRing variant="hero" percent={100} />);
    expect(screen.queryByTestId('goal-ring-overshoot-badge')).toBeNull();
  });

  it('applies progressive bands and cyan for complete and overshoot', () => {
    expect(ringBandClasses(0).border).toBe('border-ring-start');
    expect(ringBandClasses(55).border).toBe('border-ring-mid');
    expect(ringBandClasses(80).border).toBe('border-ring-end');
    expect(ringBandClasses(100).border).toBe('border-ring-complete');
    expect(ringBandClasses(150).border).toBe('border-ring-complete');
  });
});

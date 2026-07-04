import { render, screen } from '@testing-library/react-native';

import { CognitiveLoadRing, ringBandClasses } from './CognitiveLoadRing';

describe('CognitiveLoadRing', () => {
  it('has progressbar accessibility role prop', () => {
    const { UNSAFE_getByProps } = render(<CognitiveLoadRing variant="small" percent={0} />);
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(el).toBeTruthy();
  });

  it('shows 0% label when percent is 0', () => {
    render(<CognitiveLoadRing variant="small" percent={0} />);
    expect(screen.getByText('0%')).toBeTruthy();
  });

  it('shows percent label matching the prop', () => {
    render(<CognitiveLoadRing variant="small" percent={42} />);
    expect(screen.getByText('42%')).toBeTruthy();
  });

  it('uses custom accessibilityLabel when provided', () => {
    render(
      <CognitiveLoadRing
        variant="small"
        percent={0}
        accessibilityLabel="Cognitive load 0 percent"
      />,
    );
    expect(screen.getByLabelText('Cognitive load 0 percent')).toBeTruthy();
  });

  it('renders large variant with progressbar role', () => {
    const { UNSAFE_getByProps } = render(<CognitiveLoadRing variant="large" percent={0} />);
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(el).toBeTruthy();
  });

  it('renders hero variant at 144px with a thicker border', () => {
    const { UNSAFE_getByProps } = render(<CognitiveLoadRing variant="hero" percent={42} />);
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(el.props.style).toEqual({ width: 144, height: 144 });
    expect(el.props.className).toContain('border-4');
    expect(screen.getByText('42%')).toBeTruthy();
  });

  it('applies green band at 0%', () => {
    expect(ringBandClasses(0).border).toBe('border-ring-start');
    const { UNSAFE_getByProps } = render(<CognitiveLoadRing variant="small" percent={0} />);
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(el.props.className).toContain('border-ring-start');
  });

  it('applies yellow band at 55%', () => {
    expect(ringBandClasses(55).border).toBe('border-ring-mid');
    const { UNSAFE_getByProps } = render(<CognitiveLoadRing variant="small" percent={55} />);
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(el.props.className).toContain('border-ring-mid');
  });

  it('applies orange band at 80%', () => {
    expect(ringBandClasses(80).border).toBe('border-ring-end');
    const { UNSAFE_getByProps } = render(<CognitiveLoadRing variant="small" percent={80} />);
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(el.props.className).toContain('border-ring-end');
  });

  it('applies cyan complete band at 100%', () => {
    expect(ringBandClasses(100).border).toBe('border-ring-complete');
    const { UNSAFE_getByProps } = render(<CognitiveLoadRing variant="small" percent={100} />);
    const el = UNSAFE_getByProps({ accessibilityRole: 'progressbar' });
    expect(el.props.className).toContain('border-ring-complete');
    expect(screen.getByText('100%')).toBeTruthy();
  });
});

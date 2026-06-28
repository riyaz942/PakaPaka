import { render, screen } from '@testing-library/react-native';

import { CognitiveLoadRing } from './CognitiveLoadRing';

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
});

import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { GuidanceCardBody } from '@/components/onboarding/cards/GuidanceCardBody';

describe('GuidanceCardBody', () => {
  it('renders every paragraph it is given', () => {
    render(<GuidanceCardBody paragraphs={['First line.', 'Second line.', 'Third line.']} />);

    expect(screen.getByText('First line.')).toBeTruthy();
    expect(screen.getByText('Second line.')).toBeTruthy();
    expect(screen.getByText('Third line.')).toBeTruthy();
  });

  it('renders nothing but the container for an empty body', () => {
    render(<GuidanceCardBody paragraphs={[]} />);

    expect(screen.getByTestId('guidance-card-body').props.children).toHaveLength(0);
  });
});

import React from 'react';
import { render, screen } from '@testing-library/react-native';

import { GlyphText } from '@/components/common/GlyphText';

describe('GlyphText', () => {
  it('draws a form no font covers as an outline, labelled with the character', () => {
    render(<GlyphText testID="glyph">𢆉</GlyphText>);
    expect(screen.queryByText('𢆉')).toBeNull();
    expect(screen.getByLabelText('𢆉')).toBeTruthy();
  });

  it('renders any other form as text', () => {
    render(<GlyphText testID="glyph">幸</GlyphText>);
    expect(screen.getByText('幸')).toBeTruthy();
  });
});

import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { AnnotatedText } from '@/components/common/AnnotatedText';

describe('AnnotatedText', () => {
  it('renders untagged prose unchanged', () => {
    render(<AnnotatedText text="The ground cracks open." itemType="kanji" testID="prose" />);

    expect(screen.getByText('The ground cracks open.')).toBeTruthy();
  });

  it('colors a radical highlight with the radical accent', () => {
    render(
      <AnnotatedText
        text="The <radical>ground</radical> cracks open."
        itemType="kanji"
        testID="prose"
      />,
    );

    expect(screen.getByText('ground').props.className).toContain('text-content-radical');
    expect(screen.getByText('The ')).toBeTruthy();
    expect(screen.getByText(' cracks open.')).toBeTruthy();
  });

  it('colors a kanji highlight with the kanji accent', () => {
    render(<AnnotatedText text="a <kanji>mountain</kanji> of rice" itemType="vocabulary" />);

    expect(screen.getByText('mountain').props.className).toContain('text-content-kanji');
  });

  it("takes the item's own accent for a reading highlight", () => {
    render(<AnnotatedText text="he groans <reading>いち</reading> again" itemType="kanji" />);
    expect(screen.getByText('いち').props.className).toContain('text-content-kanji');

    render(<AnnotatedText text="she says <reading>ひとつ</reading> again" itemType="vocabulary" />);
    expect(screen.getByText('ひとつ').props.className).toContain('text-content-vocabulary');
  });

  it('handles several highlights in one string', () => {
    render(
      <AnnotatedText
        text="<radical>ground</radical> meets <radical>fire</radical> at dusk"
        itemType="kanji"
      />,
    );

    expect(screen.getByText('ground')).toBeTruthy();
    expect(screen.getByText('fire')).toBeTruthy();
    expect(screen.getByText(' meets ')).toBeTruthy();
  });

  it('leaves an unknown or unclosed tag as literal text rather than dropping it', () => {
    render(<AnnotatedText text="a <mystery>thing</mystery> and a <radical>stick" itemType="kanji" />);

    expect(screen.getByText('a <mystery>thing</mystery> and a <radical>stick')).toBeTruthy();
  });
});

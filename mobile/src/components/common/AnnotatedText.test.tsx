import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { AnnotatedText } from '@/components/common/AnnotatedText';

describe('AnnotatedText', () => {
  it('renders untagged prose unchanged', () => {
    render(<AnnotatedText text="The ground cracks open." testID="prose" />);

    expect(screen.getByText('The ground cracks open.')).toBeTruthy();
  });

  it('colors a radical highlight with the radical accent', () => {
    render(<AnnotatedText text="The <radical>ground</radical> cracks open." testID="prose" />);

    expect(screen.getByText('ground').props.className).toContain('text-content-radical');
    expect(screen.getByText('The ')).toBeTruthy();
    expect(screen.getByText(' cracks open.')).toBeTruthy();
  });

  it('colors a kanji highlight with the kanji accent', () => {
    render(<AnnotatedText text="a <kanji>mountain</kanji> of rice" />);

    expect(screen.getByText('mountain').props.className).toContain('text-content-kanji');
  });

  it('gives a reading highlight its own color, not the kanji accent', () => {
    render(
      <AnnotatedText text="<reading>Shin</reading> unveils something <kanji>new</kanji>" />,
    );

    const reading = screen.getByText('Shin').props.className;
    const meaning = screen.getByText('new').props.className;

    expect(reading).toContain('text-mnemonic-reading');
    // The pair this exists for: on a kanji, sound and meaning used to be the
    // same token, so the learner could not tell the two highlights apart.
    expect(reading).not.toContain('text-content-kanji');
    expect(meaning).toContain('text-content-kanji');
  });

  it('colors a tag the same way whatever item the prose belongs to', () => {
    render(<AnnotatedText text="she says <reading>ひとつ</reading> again" />);

    expect(screen.getByText('ひとつ').props.className).toContain('text-mnemonic-reading');
  });

  it('handles several highlights in one string', () => {
    render(<AnnotatedText text="<radical>ground</radical> meets <radical>fire</radical> at dusk" />);

    expect(screen.getByText('ground')).toBeTruthy();
    expect(screen.getByText('fire')).toBeTruthy();
    expect(screen.getByText(' meets ')).toBeTruthy();
  });

  it('leaves an unknown or unclosed tag as literal text rather than dropping it', () => {
    render(<AnnotatedText text="a <mystery>thing</mystery> and a <radical>stick" />);

    expect(screen.getByText('a <mystery>thing</mystery> and a <radical>stick')).toBeTruthy();
  });
});

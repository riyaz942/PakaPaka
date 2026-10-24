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

  it('colors a vocabulary highlight with the vocabulary accent, apart from its kanji', () => {
    render(
      <AnnotatedText text="one more <kanji>mouth</kanji> makes an <vocabulary>employee</vocabulary>" />,
    );

    const borrowed = screen.getByText('mouth').props.className;
    const landing = screen.getByText('employee').props.className;

    // The pair this exists for: a word borrows <kanji> from below and lands on
    // <vocabulary>, and the learner has to see which is which.
    expect(landing).toContain('text-content-vocabulary');
    expect(landing).not.toContain('text-content-kanji');
    expect(borrowed).toContain('text-content-kanji');
  });

  it('colors a radical part apart from the radical it builds', () => {
    render(
      <AnnotatedText text='<part form="重">heavy</part> boxes you <radical form="動">move</radical>' />,
    );

    const part = screen.getByText('heavy (重)').props.className;
    const landing = screen.getByText('move (動)').props.className;

    expect(part).toContain('text-brand-text');
    expect(part).not.toContain('text-content-radical');
    expect(landing).toContain('text-content-radical');
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

  it('prints the character a tag names, after the word, in its accent', () => {
    render(
      <AnnotatedText text='a <kanji form="少">few</kanji> <kanji form="年">year</kanji>s' />,
    );

    // The glyph rides inside the highlight, so the learner reads "few (少)" as
    // one run and the two never wrap apart.
    expect(screen.getByText('few (少)')).toBeTruthy();
    expect(screen.getByText('year (年)').props.className).toContain('text-content-kanji');
    expect(screen.getByText(' (年)').props.className).toContain('font-jp-bold');
  });

  it('draws a character no font covers as an outline, inside the parentheses', () => {
    render(<AnnotatedText text='at an <radical form="兑">exchange</radical>.' />);

    expect(screen.queryByText(/兑/)).toBeNull();
    expect(screen.getByLabelText('兑')).toBeTruthy();
  });

  it('prints the whole written form on the word a vocabulary story lands on', () => {
    render(<AnnotatedText text='he is a <vocabulary form="少年">boy</vocabulary>' />);

    expect(screen.getByText('boy (少年)').props.className).toContain('text-content-vocabulary');
  });

  it('renders a tag with no character exactly as it always did', () => {
    render(<AnnotatedText text="The <radical>ground</radical> cracks open." />);

    expect(screen.getByText('ground').props.className).toContain('text-content-radical');
    expect(screen.queryByText(/\(/)).toBeNull();
  });

  it('marks a grammar meaning in bold primary text, apart from the gold reading', () => {
    render(
      <AnnotatedText text={'says "<reading>OK</reading>": all set <grammar>for later</grammar>.'} />,
    );

    const meaning = screen.getByText('for later').props.className;
    const sound = screen.getByText('OK').props.className;

    // The grammar accent is the same gold as the reading token, so the meaning
    // takes the primary text colour instead (grammar mnemonics spec §2).
    expect(meaning).toContain('font-ui-bold');
    expect(meaning).toContain('text-primary');
    expect(meaning).not.toContain('text-mnemonic-reading');
    expect(sound).toContain('text-mnemonic-reading');
  });

  it('shows a linked example word as plain text where no link is available', () => {
    render(<AnnotatedText text="Story. {{7||今日}}<reading>は</reading>{{9||寒い}}。" />);

    expect(screen.queryByText(/\{\{/)).toBeNull();
    expect(screen.getByText('は').props.className).toContain('text-mnemonic-reading');
  });
});

import { fireEvent, render, screen } from '@testing-library/react-native';
import React from 'react';

import { GrammarMnemonicBlock } from '@/components/learn/GrammarMnemonicBlock';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => mockPush(...args) } }));
jest.mock('@/data/hooks/useFuriganaPreference', () => ({
  useFuriganaPreference: () => ({
    mode: 'auto',
    knownKanji: new Set<string>(),
    modeForItem: () => 'auto',
    setOverride: jest.fn(),
  }),
}));
jest.mock('@/data/hooks/useDatabase', () => {
  const databases = { userDb: { getFirstSync: jest.fn(() => null) }, curriculumDb: {} };
  return { useDatabase: () => databases };
});

const LINKED =
  'Sei says "<reading>Wha</reading>t about me?", so now <grammar>the topic</grammar> is clear. ' +
  '{{7||今日}}<reading>は</reading>{{9||寒い}}。';

describe('GrammarMnemonicBlock', () => {
  beforeEach(() => mockPush.mockReset());

  it('renders the mnemonic under a Mnemonic heading', () => {
    render(<GrammarMnemonicBlock mnemonicText={'nods "<reading>OK</reading>": <grammar>for later</grammar>.'} />);

    expect(screen.getByTestId('grammar-mnemonic')).toBeTruthy();
    expect(screen.getByText('Mnemonic')).toBeTruthy();
    expect(screen.getByText('for later')).toBeTruthy();
  });

  it('says the mnemonic is coming when the point has none yet', () => {
    render(<GrammarMnemonicBlock mnemonicText={null} />);

    expect(screen.getByTestId('grammar-mnemonic-placeholder')).toBeTruthy();
    expect(screen.getByText('Mnemonic coming soon')).toBeTruthy();
  });

  it('shows the story with its tags and the example with linked words', () => {
    render(<GrammarMnemonicBlock mnemonicText={LINKED} />);

    expect(screen.getByText('the topic')).toBeTruthy();
    expect(screen.getByText('Wha')).toBeTruthy();
    expect(screen.getByTestId('grammar-mnemonic-word-7-0')).toBeTruthy();
    expect(screen.getByTestId('grammar-mnemonic-word-9-2')).toBeTruthy();
    // The grammar form in the example is the sound highlight, not a link.
    expect(screen.getByText('は').props.className).toContain('text-mnemonic-reading');
    expect(screen.queryByText(/\{\{/)).toBeNull();
  });

  it('opens the word when a linked example word is tapped', () => {
    render(<GrammarMnemonicBlock mnemonicText={LINKED} />);

    fireEvent.press(screen.getByTestId('grammar-mnemonic-word-9-2'));

    expect(mockPush).toHaveBeenCalledWith('/browse/item/9');
  });

  it('passes the surface for a stem span', () => {
    render(
      <GrammarMnemonicBlock
        mnemonicText={'Story here, more story here. {{4||食べ}}<reading>たい</reading>。'}
      />,
    );

    fireEvent.press(screen.getByTestId('grammar-mnemonic-word-4-0'));

    expect(mockPush).toHaveBeenCalledWith('/browse/item/4');
  });

  it('renders text with no Japanese example as plain annotated prose', () => {
    render(<GrammarMnemonicBlock mnemonicText={'Only a story with a <grammar>meaning</grammar>.'} />);

    expect(screen.getByText('meaning')).toBeTruthy();
  });
});

import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { GrammarMnemonicBlock } from '@/components/learn/GrammarMnemonicBlock';

describe('GrammarMnemonicBlock', () => {
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
});

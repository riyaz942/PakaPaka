import React from 'react';
import { View } from 'react-native';

import { AnnotatedText } from '@/components/common/AnnotatedText';
import { ContentPlaceholderNotice } from '@/components/common/ContentPlaceholderNotice';
import { SectionHeading } from '@/components/common/SectionHeading';
import { MNEMONIC_PROSE } from '@/components/learn/ItemMnemonicSections';

type GrammarMnemonicBlockProps = {
  mnemonicText: string | null;
};

/**
 * A grammar point's curriculum mnemonic (grammar mnemonics spec §7): a short
 * story in which an English sound-alike of the form is its meaning, ending on a
 * Japanese example. Every N5/N4 point gets one, so a missing one is content the
 * pipeline has not reached yet and says so, the same as a vocabulary word.
 */
export function GrammarMnemonicBlock({ mnemonicText }: GrammarMnemonicBlockProps) {
  return (
    <View
      className="mt-space-md"
      testID={mnemonicText ? 'grammar-mnemonic' : 'grammar-mnemonic-placeholder'}>
      <SectionHeading label="Mnemonic" />
      {mnemonicText ? (
        <AnnotatedText text={mnemonicText} className={MNEMONIC_PROSE} />
      ) : (
        <ContentPlaceholderNotice label="Mnemonic coming soon" />
      )}
    </View>
  );
}

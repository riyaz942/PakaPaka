import React, { useState } from 'react';
import { Pressable } from 'react-native';

import { ExplainerSheet } from '@/components/common/ExplainerSheet';
import { Icon } from '@/components/common/Icon';
import {
  GUIDANCE_CARD_BY_ID,
  type GuidanceCardId,
} from '@/components/onboarding/cardRegistry';

type GuidanceInfoButtonProps = {
  cardId: GuidanceCardId;
  testID?: string;
};

/**
 * The registry-card twin of `SectionHeading`'s `infoTopic` affordance: an info
 * button that opens the named guidance card in the shared `ExplainerSheet`.
 *
 * Naming one card is a reference, not a branch — the surface says which card
 * explains it, and everything else about that card lives in the registry.
 */
export function GuidanceInfoButton({ cardId, testID }: GuidanceInfoButtonProps) {
  const [sheetVisible, setSheetVisible] = useState(false);
  const card = GUIDANCE_CARD_BY_ID[cardId];
  const { Render } = card;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Explain: ${card.title}`}
        onPress={() => setSheetVisible(true)}
        testID={testID ?? `guidance-info-${cardId}`}
        className="min-h-[44px] min-w-[44px] items-center justify-center">
        <Icon name="info" size={16} strokeWidth={2} className="text-brand-text" />
      </Pressable>

      <ExplainerSheet
        title={card.title}
        visible={sheetVisible}
        onDismiss={() => setSheetVisible(false)}>
        <Render />
      </ExplainerSheet>
    </>
  );
}

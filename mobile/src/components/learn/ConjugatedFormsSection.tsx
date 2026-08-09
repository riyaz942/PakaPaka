import React from 'react';
import { Text, View } from 'react-native';

import { SectionHeading } from '@/components/common/SectionHeading';
import { INFLECTION_LABEL } from '@/core/content/inflection';
import { useConjugatedForms } from '@/data/hooks/useConjugatedForms';

/**
 * The taught forms a word is shown in across the curriculum's examples (14.1).
 *
 * Not a conjugation table: only the forms the learner will actually meet, one
 * representative surface each. A word with no conjugated usage renders nothing.
 */
export function ConjugatedFormsSection({ itemId }: { itemId: string }) {
  const forms = useConjugatedForms(itemId);

  if (forms.length === 0) {
    return null;
  }

  return (
    <View className="mt-space-md" testID="conjugated-forms-section">
      <SectionHeading label="Conjugated forms" />
      <View className="mt-space-sm gap-space-xs">
        {forms.map((form) => (
          <View
            key={form.inflection}
            className="flex-row items-baseline gap-space-sm"
            testID={`conjugated-form-${form.inflection}`}>
            <Text className="text-body-lg font-jp-medium text-content-vocabulary-deep">
              {form.surface}
            </Text>
            <Text className="text-caption font-ui text-muted">
              {INFLECTION_LABEL[form.inflection]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

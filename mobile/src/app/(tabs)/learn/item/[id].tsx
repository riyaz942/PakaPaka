import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { GrammarDetail } from '@/components/learn/GrammarDetail';
import { KanjiDetail } from '@/components/learn/KanjiDetail';
import { RadicalDetail } from '@/components/learn/RadicalDetail';
import { VocabularyDetail } from '@/components/learn/VocabularyDetail';
import { MaxContentWidth } from '@/constants/theme';
import { useItemDependencyStatus } from '@/data/hooks/useItemDependencyStatus';
import { useItemDetail } from '@/data/hooks/useItemDetail';

export default function LearnItemDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const itemId = params.id ?? null;
  const {
    item,
    kanjiReadings,
    acceptedAnswers,
    grammarRule,
    exampleSentences,
    grammarVocabLinks,
    relatedGrammar,
    loading,
    notFound,
  } = useItemDetail(itemId);
  const { parents, isLocked, unmetPrerequisites } = useItemDependencyStatus(itemId);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader backTestID="learn-item-back" />
      <SafeAreaView
        edges={['left', 'right']}
        className="flex-1"
        style={{
          alignSelf: 'center',
          maxWidth: MaxContentWidth,
          width: '100%',
        }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          className="flex-1">
          <ScrollView
            className="flex-1"
            contentContainerClassName="px-space-lg pt-space-md pb-space-2xl"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator
            testID="learn-item-scroll">
            {loading ? (
              <View className="mt-8 items-center">
                <ActivityIndicator accessibilityLabel="Loading item" />
              </View>
            ) : notFound || !item ? (
              <Text className="mt-8 text-body text-secondary">Item not found.</Text>
            ) : item.itemType === 'radical' ? (
              <RadicalDetail item={item} />
            ) : item.itemType === 'kanji' ? (
              <KanjiDetail
                item={item}
                kanjiReadings={kanjiReadings ?? []}
                acceptedAnswers={acceptedAnswers}
                parents={parents}
                isLocked={isLocked}
                unmetPrerequisites={unmetPrerequisites}
              />
            ) : item.itemType === 'vocabulary' ? (
              <VocabularyDetail
                item={item}
                acceptedAnswers={acceptedAnswers}
                exampleSentences={exampleSentences}
                grammarVocabLinks={grammarVocabLinks}
                parents={parents}
                isLocked={isLocked}
                unmetPrerequisites={unmetPrerequisites}
              />
            ) : item.itemType === 'grammar' ? (
              <GrammarDetail
                item={item}
                acceptedAnswers={acceptedAnswers}
                grammarRule={grammarRule}
                exampleSentences={exampleSentences}
                relatedGrammar={relatedGrammar}
              />
            ) : null}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

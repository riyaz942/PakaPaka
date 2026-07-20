import { router, useLocalSearchParams, type Href } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { PassageLockedTodo } from '@/components/read/PassageLockedTodo';
import { PassageReader } from '@/components/read/PassageReader';
import { MaxContentWidth } from '@/constants/theme';
import { usePassageDetail } from '@/data/hooks/usePassageDetail';
import type { PassagePracticeResult } from '@/data/user/passagePracticeRepository';

/**
 * Passage reader body, shared by the Browse passage route
 * (`/browse/passage/[id]`). Extracted from the former `/read/[id]` screen when
 * the Read tab folded into Browse.
 */
export function PassageDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const passageId = params.id ?? null;
  const {
    passage,
    questions,
    practiceResults,
    wordSpans,
    unlock,
    isUnlocked,
    neededItems,
    loading,
    notFound,
  } = usePassageDetail(passageId);
  const [localPracticeResults, setLocalPracticeResults] =
    useState<PassagePracticeResult[]>(practiceResults);

  useEffect(() => {
    setLocalPracticeResults(practiceResults);
  }, [practiceResults, passageId]);

  const handleAnswerSubmitted = useCallback((result: PassagePracticeResult) => {
    setLocalPracticeResults((current) => {
      const withoutQuestion = current.filter((entry) => entry.questionId !== result.questionId);
      return [...withoutQuestion, result];
    });
  }, []);

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader backTestID="read-passage-back" />
      <SafeAreaView
        edges={['left', 'right']}
        className="flex-1 px-space-lg pt-space-md"
        style={{
          alignSelf: 'center',
          maxWidth: MaxContentWidth,
          width: '100%',
        }}>
        {loading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator accessibilityLabel="Loading passage" />
          </View>
        ) : notFound || !passage ? (
          <Text className="mt-8 text-body text-secondary">Passage not found.</Text>
        ) : (
          <ScrollView>
            {isUnlocked ? (
              <PassageReader
                passage={passage}
                questions={questions}
                practiceResults={localPracticeResults}
                wordSpans={wordSpans}
                onAnswerSubmitted={handleAnswerSubmitted}
              />
            ) : (
              <PassageLockedTodo
                passage={passage}
                unlock={unlock}
                neededItems={neededItems}
                onItemPress={(itemId) => router.push(`/browse/item/${itemId}` as Href)}
              />
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

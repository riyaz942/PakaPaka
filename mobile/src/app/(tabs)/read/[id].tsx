import { router, useLocalSearchParams } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PassageReader } from '@/components/read/PassageReader';
import { MaxContentWidth } from '@/constants/theme';
import { usePassageDetail } from '@/data/hooks/usePassageDetail';
import type { PassagePracticeResult } from '@/data/user/passagePracticeRepository';

export default function ReadPassageScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const passageId = params.id ?? null;
  const { passage, questions, practiceResults, loading, notFound } = usePassageDetail(passageId);
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
      <SafeAreaView
        className="flex-1 px-space-lg pt-space-md"
        style={{
          alignSelf: 'center',
          maxWidth: MaxContentWidth,
          width: '100%',
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          testID="read-passage-back"
          className="mb-2 min-h-[44px] self-start justify-center py-1">
          <Text className="text-body text-feedback-info">Back</Text>
        </Pressable>

        {loading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator accessibilityLabel="Loading passage" />
          </View>
        ) : notFound || !passage ? (
          <Text className="mt-8 text-body text-secondary">Passage not found.</Text>
        ) : (
          <ScrollView>
            <PassageReader
              passage={passage}
              questions={questions}
              practiceResults={localPracticeResults}
              onAnswerSubmitted={handleAnswerSubmitted}
            />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

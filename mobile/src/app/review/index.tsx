import { usePreventRemove } from '@react-navigation/core';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReviewCard, SessionExitSheet, SessionHeader } from '@/components/review';
import type { PromptType } from '@/core/srs/promptResolver';
import type { ReviewGrade } from '@/core/srs/srs.types';
import { useReviewSession } from '@/providers/ReviewSessionProvider';

const PLACEHOLDER: Record<PromptType, string> = {
  reading: 'Type reading in hiragana...',
  meaning: 'Type the meaning in English...',
  production: 'Type the conjugated form...',
};

function DevGradeButtons({ onGrade }: { onGrade: (g: ReviewGrade) => void }) {
  const GRADES: { grade: ReviewGrade; label: string }[] = [
    { grade: 1, label: 'Again' },
    { grade: 2, label: 'Hard' },
    { grade: 3, label: 'Good' },
    { grade: 4, label: 'Easy' },
  ];
  return (
    <View className="flex-row gap-space-sm px-space-lg pb-space-md">
      {GRADES.map(({ grade, label }) => (
        <Pressable
          key={grade}
          accessibilityRole="button"
          accessibilityLabel={label}
          className="flex-1 items-center rounded-radius-md bg-surface-elevated py-space-sm"
          onPress={() => onGrade(grade)}>
          <Text className="text-body-sm text-secondary">{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ReviewScreen() {
  const {
    currentItem,
    isLoading,
    isComplete,
    totalItems,
    currentIndex,
    error,
    refetch,
    gradeCurrentItem,
  } = useReviewSession();

  const [exitVisible, setExitVisible] = useState(false);
  const isEndingRef = useRef(false);
  const hasActiveSession = totalItems > 0 && !isComplete && !isLoading && !error;

  usePreventRemove(hasActiveSession && !exitVisible && !isEndingRef.current, () => {
    setExitVisible(true);
  });

  // Android hardware back: consume event while session is active or exit sheet is open
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!hasActiveSession) return false;
      if (exitVisible) return true; // sheet is open; let Modal's onRequestClose handle it
      setExitVisible(true);
      return true;
    });
    return () => sub.remove();
  }, [hasActiveSession, exitVisible]);

  function handleEndSession() {
    if (isEndingRef.current) return;
    isEndingRef.current = true;
    setExitVisible(false);
    router.back();
  }

  function handleKeepGoing() {
    setExitVisible(false);
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background px-space-lg">
        <View className="flex-1 justify-center gap-space-md">
          <Text className="text-title text-primary">Review Unavailable</Text>
          <Text className="text-body text-secondary">
            {error.userMessage ?? error.message}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="self-start rounded-radius-md bg-surface px-space-md py-space-sm"
            onPress={refetch}>
            <Text className="text-body text-feedback-info">Retry</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            className="self-start rounded-radius-md bg-surface px-space-md py-space-sm"
            onPress={() => router.back()}>
            <Text className="text-body text-secondary">Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isComplete || (totalItems === 0 && !isLoading)) {
    return (
      <SafeAreaView className="flex-1 bg-background px-space-lg">
        <View className="flex-1 justify-center gap-space-md">
          <Text className="text-title text-primary">Session Complete</Text>
          <Text className="text-body text-secondary">
            {totalItems === 0
              ? 'No items due for review right now.'
              : `Great work! You reviewed ${totalItems} item${totalItems !== 1 ? 's' : ''}.`}
          </Text>
          <Pressable
            accessibilityRole="button"
            className="self-start rounded-radius-md bg-surface px-space-md py-space-sm"
            onPress={() => router.back()}>
            <Text className="text-body text-feedback-info">Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!currentItem) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <SessionHeader
        currentIndex={currentIndex}
        totalItems={totalItems}
        itemType={currentItem.itemType}
        onExitPress={() => setExitVisible(true)}
      />

      <View className="flex-1 justify-center px-space-md">
        <ReviewCard item={currentItem} state="prompting" />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="px-space-md pb-space-md">
          <TextInput
            className="w-full rounded-radius-md bg-surface-elevated px-space-md py-space-sm text-body text-primary"
            placeholder={PLACEHOLDER[currentItem.promptType]}
            placeholderTextColor="rgba(255,255,255,0.4)"
            editable={false}
            accessibilityLabel="Answer input"
          />
        </View>
        {__DEV__ && <DevGradeButtons onGrade={gradeCurrentItem} />}
      </KeyboardAvoidingView>

      <SessionExitSheet
        visible={exitVisible}
        onKeepGoing={handleKeepGoing}
        onEndSession={handleEndSession}
      />
    </SafeAreaView>
  );
}

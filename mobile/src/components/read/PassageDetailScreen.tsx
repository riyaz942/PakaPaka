import { router, useLocalSearchParams, type Href } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/common/Icon';
import { ScreenHeader } from '@/components/common/ScreenHeader';
import { PassageLockedTodo } from '@/components/read/PassageLockedTodo';
import { PassageReader } from '@/components/read/PassageReader';
import { MaxContentWidth } from '@/constants/theme';
import { usePassageDetail } from '@/data/hooks/usePassageDetail';
import type { PassagePracticeResult } from '@/data/user/passagePracticeRepository';

/** Room kept below the focused answer box so its Submit button also shows. */
const ANSWER_ACTION_CLEARANCE = 96;

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
    recentWord,
    loading,
    notFound,
  } = usePassageDetail(passageId);
  const [localPracticeResults, setLocalPracticeResults] =
    useState<PassagePracticeResult[]>(practiceResults);

  useEffect(() => {
    setLocalPracticeResults(practiceResults);
  }, [practiceResults, passageId]);

  const scrollRef = useRef<ScrollView>(null);
  const scrollYRef = useRef(0);

  // When the keyboard shrinks the scroll area, bring the focused answer box
  // (and its Submit button) back into view.
  const revealFocusedInput = useCallback(() => {
    const input = TextInput.State.currentlyFocusedInput();
    const scroll = scrollRef.current;
    const scrollHost = scroll?.getNativeScrollRef();
    if (!input || !scroll || !scrollHost) return;
    scrollHost.measureInWindow((_sx, scrollY, _sw, scrollHeight) => {
      input.measureInWindow((_x, y, _width, height) => {
        const overlap = y + height + ANSWER_ACTION_CLEARANCE - (scrollY + scrollHeight);
        if (overlap > 0) {
          scroll.scrollTo({ y: scrollYRef.current + overlap, animated: true });
        }
      });
    });
  }, []);

  const handleAnswerSubmitted = useCallback((result: PassagePracticeResult) => {
    setLocalPracticeResults((current) => {
      const withoutQuestion = current.filter((entry) => entry.questionId !== result.questionId);
      return [...withoutQuestion, result];
    });
  }, []);

  return (
    // Wraps the whole screen: KeyboardAvoidingView measures itself against its
    // parent, so nesting it below the header under-counts the keyboard overlap.
    <KeyboardAvoidingView behavior="padding" className="flex-1 bg-background">
      <ScreenHeader backTestID="read-passage-back">
        <View className="self-start rounded-radius-full bg-content-passage-soft px-space-sm py-[5px]">
          <Text className="text-overline font-ui-bold uppercase tracking-[0.1em] text-content-passage-deep">
            Passage
          </Text>
        </View>
        <View className="flex-1" />
        {passage && isUnlocked ? (
          <View
            testID="passage-open-pill"
            className="flex-row items-center gap-space-xs rounded-radius-full bg-feedback-correct-soft px-space-sm py-[5px]">
            <Icon name="correct" size={11} strokeWidth={3} className="text-feedback-correct-deep" />
            <Text className="text-overline font-ui-bold uppercase tracking-[0.1em] text-feedback-correct-deep">
              Open
            </Text>
          </View>
        ) : null}
      </ScreenHeader>
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
          <ScrollView
            ref={scrollRef}
            onLayout={revealFocusedInput}
            onScroll={(event) => {
              scrollYRef.current = event.nativeEvent.contentOffset.y;
            }}
            scrollEventThrottle={16}
            contentContainerClassName="pb-space-xl"
            keyboardShouldPersistTaps="handled">
            {isUnlocked ? (
              <PassageReader
                passage={passage}
                questions={questions}
                practiceResults={localPracticeResults}
                wordSpans={wordSpans}
                recentWord={recentWord}
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
    </KeyboardAvoidingView>
  );
}

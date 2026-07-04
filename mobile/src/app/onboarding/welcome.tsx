import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { OnboardingStep } from '@/components/common/OnboardingStep';
import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { JlptLevelPicker } from '@/components/onboarding/JlptLevelPicker';
import { LevelPathCard } from '@/components/onboarding/LevelPathCard';
import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import { useDatabase } from '@/data/hooks/useDatabase';
import { setOnboardingPath, setStartingJlptLevel } from '@/data/user/preferencesRepository';

export default function WelcomeScreen() {
  const { userDb } = useDatabase();
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel | null>(null);

  const handleBeginner = () => {
    setStartingJlptLevel(userDb, 'N5');
    setOnboardingPath(userDb, 'beginner');
    router.replace('/onboarding/intensity');
  };

  const handleContinue = () => {
    if (!selectedLevel) {
      return;
    }

    setStartingJlptLevel(userDb, selectedLevel);
    setOnboardingPath(userDb, 'manual');
    router.replace('/onboarding/intensity');
  };

  return (
    <OnboardingStep
      title="Learn Japanese for real"
      description="Kanji, vocabulary, and grammar in one app — free, offline, no account. Where should we start?"
      stepIndex={1}
      stepCount={4}
      primaryAction={{
        label: 'Continue',
        onPress: handleContinue,
        disabled: !selectedLevel,
      }}>
      <View className="gap-3">
        <FadeSlideIn index={0}>
          <LevelPathCard
            title="I'm new to Japanese"
            description="Start from zero — radicals, first kanji, and grammar foundations. Your first lesson is minutes away."
            badge="Most popular"
            onPress={handleBeginner}
            testID="path-beginner"
          />
        </FadeSlideIn>

        <FadeSlideIn index={1}>
          <LevelPathCard
            title="I know some Japanese"
            description="Pick your JLPT level and take a 1-minute check — we'll skip what you already know."
            selected={showLevelPicker}
            onPress={() => {
              setShowLevelPicker(true);
              setSelectedLevel(null);
            }}
            testID="path-intermediate">
            {showLevelPicker ? (
              <JlptLevelPicker
                selectedLevel={selectedLevel}
                onSelect={setSelectedLevel}
                testID="jlpt-picker"
              />
            ) : null}
          </LevelPathCard>
        </FadeSlideIn>

        <FadeSlideIn index={2}>
          <LevelPathCard
            title="I have existing knowledge"
            description="Import from WaniKani, Bunpro, or Anki — keep everything you've learned."
            accentBorder
            onPress={() => {
              setOnboardingPath(userDb, 'import');
              router.push('/onboarding/import');
            }}
            testID="path-import">
            <View className="mt-3 flex-row flex-wrap gap-2">
              {['WaniKani API', 'Bunpro', 'Anki (.apkg)'].map((label) => (
                <View
                  key={label}
                  className="rounded-radius-sm bg-surface-elevated px-2 py-1">
                  <Text className="text-overline text-secondary">{label}</Text>
                </View>
              ))}
            </View>
          </LevelPathCard>
        </FadeSlideIn>
      </View>
    </OnboardingStep>
  );
}

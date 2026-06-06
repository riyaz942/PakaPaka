import { router } from 'expo-router';
import React, { useState } from 'react';
import { Text, View } from 'react-native';

import { OnboardingStep } from '@/components/common/OnboardingStep';
import { JlptLevelPicker } from '@/components/onboarding/JlptLevelPicker';
import { LevelPathCard } from '@/components/onboarding/LevelPathCard';
import type { JLPTLevel } from '@/data/curriculum/curriculum.types';
import { useDatabase } from '@/data/hooks/useDatabase';
import { setStartingJlptLevel } from '@/data/user/preferencesRepository';

type PathChoice = 'beginner' | 'intermediate' | null;

export default function WelcomeScreen() {
  const { userDb } = useDatabase();
  const [selectedPath, setSelectedPath] = useState<PathChoice>(null);
  const [selectedLevel, setSelectedLevel] = useState<JLPTLevel | null>(null);

  const resolvedLevel: JLPTLevel | null =
    selectedPath === 'beginner' ? 'N5' : selectedPath === 'intermediate' ? selectedLevel : null;

  const handleContinue = () => {
    if (!resolvedLevel) {
      return;
    }

    setStartingJlptLevel(userDb, resolvedLevel);
    router.replace('/onboarding/intensity');
  };

  return (
    <OnboardingStep
      title="Where are you starting?"
      description="No account needed. You can change this later."
      stepIndex={1}
      stepCount={4}
      primaryAction={{
        label: 'Continue',
        onPress: handleContinue,
        disabled: !resolvedLevel,
      }}>
      <View className="gap-3">
        <LevelPathCard
          title="I'm a beginner"
          description="Start from N5 — radicals, basic kanji, grammar foundations"
          badge="Recommended for new learners"
          selected={selectedPath === 'beginner'}
          onPress={() => {
            setSelectedPath('beginner');
            setSelectedLevel('N5');
          }}
          testID="path-beginner"
        />

        <LevelPathCard
          title="I know some Japanese"
          description="Choose your JLPT level and mark what you already know"
          selected={selectedPath === 'intermediate'}
          onPress={() => {
            setSelectedPath('intermediate');
            setSelectedLevel(null);
          }}
          testID="path-intermediate">
          {selectedPath === 'intermediate' ? (
            <JlptLevelPicker
              selectedLevel={selectedLevel}
              onSelect={setSelectedLevel}
              testID="jlpt-picker"
            />
          ) : null}
        </LevelPathCard>

        <LevelPathCard
          title="Import my progress"
          description="From WaniKani, Bunpro, or Anki — keep everything you've learned"
          accentBorder
          onPress={() => router.push('/onboarding/import')}
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
      </View>
    </OnboardingStep>
  );
}

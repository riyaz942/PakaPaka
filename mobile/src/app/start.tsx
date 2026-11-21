import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { FadeSlideIn } from '@/components/common/FadeSlideIn';
import { useAccount } from '@/providers/AccountProvider';
import { getRadicalImage } from '@/utils/radicalImages';

const RADICALS = [
  { glyph: '士', name: 'samurai', image: 'radicals/samurai.webp' },
  { glyph: '冖', name: 'cover', image: 'radicals/wakanmuri.webp' },
  { glyph: '儿', name: 'legs', image: 'radicals/hitoashi.webp' },
];

function ChainArrow() {
  return (
    <Text
      accessible={false}
      importantForAccessibility="no"
      accessibilityElementsHidden
      className="my-space-xs text-center text-body font-ui text-muted">
      ↓
    </Text>
  );
}

/**
 * The phone's first screen: a fresh install and "Sign out and erase my data" both open it.
 * Signing in here hands over to the sign-in wait; once the sync has run, the redirect hook opens
 * the dashboard when the account's progress holds a finished onboarding, and onboarding goes on
 * otherwise.
 */
export default function StartScreen() {
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const left = useRef(false);
  const [barHeight, setBarHeight] = useState(0);

  useEffect(() => {
    if (account.status === 'signed_in' && !left.current) {
      left.current = true;
      router.replace('/onboarding/welcome');
    }
  }, [account.status]);

  return (
    <View testID="start-screen" className="flex-1 bg-background">
      <ScrollView
        testID="start-scroll"
        contentContainerStyle={{
          paddingTop: insets.top + 24,
          paddingBottom: barHeight + 24,
          paddingHorizontal: 24,
        }}>
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          className="absolute border-2 border-primary/10"
          style={{ top: insets.top + 8, right: -34, width: 230, height: 230 }}>
          <View className="absolute left-0 right-0 top-1/2 h-px bg-primary/5" />
          <View className="absolute bottom-0 left-1/2 top-0 w-px bg-primary/5" />
          <Text
            allowFontScaling={false}
            className="text-center font-jp-hero-bold text-[190px] leading-[226px] text-primary/5">
            話
          </Text>
        </View>

        <FadeSlideIn index={0}>
          <Text className="text-title font-ui-extrabold text-brand-text">PakaPaka</Text>
          <Image
            source={require('@/assets/images/mascot/alpi-yay.png')}
            style={{ width: 150, height: 150 }}
            resizeMode="contain"
            accessible={false}
            className="mt-space-md"
          />
          <Text className="mt-space-md text-overline font-ui-bold tracking-wider text-brand-text">
            A FREE, OPEN-SOURCE JAPANESE COURSE
          </Text>
          <Text
            accessibilityRole="header"
            className="mt-space-sm font-display text-[34px] leading-[37px] text-primary">
            Every kanji is a story{' '}
            <Text className="font-display-italic text-brand-text">you already know.</Text>
          </Text>
          <Text className="mt-space-md text-body font-ui text-secondary">
            Radicals build kanji. Kanji build words. Each step has a mnemonic made from the step
            before it.
          </Text>
        </FadeSlideIn>

        <FadeSlideIn index={1} className="mt-space-xl">
          <Text className="mb-space-md font-display text-title text-primary">
            One story, three steps
          </Text>
          <View className="flex-row gap-space-sm">
            {RADICALS.map((radical) => (
              <View
                key={radical.glyph}
                className="flex-1 items-center rounded-radius-md border border-border bg-surface p-space-sm">
                <Image
                  source={getRadicalImage(radical.image)}
                  style={{ width: 44, height: 44 }}
                  accessible={false}
                />
                <Text className="mt-space-xs text-title font-jp-hero-bold text-content-radical-deep">
                  {radical.glyph}
                </Text>
                <Text className="text-caption font-ui text-muted">{radical.name}</Text>
              </View>
            ))}
          </View>
          <ChainArrow />
          <View className="flex-row overflow-hidden rounded-radius-md bg-content-kanji-soft">
            <View className="w-1 bg-content-kanji" />
            <View className="flex-1 flex-row items-center gap-space-md p-space-md">
              <Text className="text-title-lg font-jp-hero-bold text-content-kanji-deep">売</Text>
              <View className="flex-1">
                <Text className="text-body font-ui-bold text-content-kanji-deep">sell</Text>
                <Text className="text-caption font-ui text-content-kanji-deep">
                  A proud samurai under a cover walks the road to sell.
                </Text>
              </View>
            </View>
          </View>
          <ChainArrow />
          <View className="flex-row overflow-hidden rounded-radius-md bg-content-vocabulary-soft">
            <View className="w-1 bg-content-vocabulary" />
            <View className="flex-1 flex-row items-center gap-space-md p-space-md">
              <Text className="text-title-lg font-jp-hero-bold text-content-vocabulary-deep">
                売る
              </Text>
              <View className="flex-1">
                <Text className="text-body font-ui-bold text-content-vocabulary-deep">to sell</Text>
                <Text className="text-caption font-ui text-content-vocabulary-deep">
                  The same samurai calls 「うる」 at every gate.
                </Text>
              </View>
            </View>
          </View>
        </FadeSlideIn>

        <FadeSlideIn index={2} className="mt-space-xl gap-space-sm">
          <Text className="mb-space-xs font-display text-title text-primary">
            Yours, with no strings
          </Text>
          <View className="rounded-radius-md border border-border bg-surface p-space-md">
            <Text className="text-body-sm font-ui text-secondary">
              <Text className="font-ui-bold text-primary">Free</Text> and open source
            </Text>
          </View>
          <View className="rounded-radius-md border border-border bg-surface p-space-md">
            <Text className="text-body-sm font-ui text-secondary">
              <Text className="font-ui-bold text-primary">Works offline.</Text> Progress stays on
              your phone.
            </Text>
          </View>
          <View className="rounded-radius-md border border-border bg-surface p-space-md">
            <Text className="text-body-sm font-ui text-secondary">
              <Text className="font-ui-bold text-primary">No account needed.</Text> Log in only to
              sync.
            </Text>
          </View>
        </FadeSlideIn>
      </ScrollView>

      <View
        testID="start-actions"
        className="absolute bottom-0 left-0 right-0 gap-space-sm border-t border-border bg-background px-6 pt-4"
        style={{ paddingBottom: insets.bottom + 16 }}
        onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}>
        <Button
          label="Start without logging in"
          onPress={() => router.replace('/onboarding/welcome')}
          className="w-full"
          testID="start-begin"
        />
        <Button
          label="Log in with Google"
          variant="secondary"
          onPress={() => void account.signIn()}
          disabled={account.status !== 'signed_out'}
          className="w-full"
          testID="start-login"
        />
        {account.error ? (
          <Text
            className="text-caption font-ui-medium text-feedback-incorrect-deep"
            testID="start-login-error">
            {account.error}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

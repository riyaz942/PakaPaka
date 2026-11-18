import { router } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/common/Button';
import { useAccount } from '@/providers/AccountProvider';

/**
 * Where the phone opens after "Sign out and erase my data". Signing in here hands over to the
 * sign-in wait; once the sync has run, the redirect hook opens the dashboard when the account's
 * progress holds a finished onboarding, and onboarding goes on otherwise.
 */
export default function StartScreen() {
  const insets = useSafeAreaInsets();
  const account = useAccount();
  const left = useRef(false);

  useEffect(() => {
    if (account.status === 'signed_in' && !left.current) {
      left.current = true;
      router.replace('/onboarding/welcome');
    }
  }, [account.status]);

  return (
    <View
      testID="start-screen"
      className="flex-1 justify-between bg-background px-6"
      style={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 16 }}>
      <View>
        <Text
          accessibilityRole="header"
          className="text-title-lg font-ui-extrabold tracking-[-0.01em] text-primary">
          PakaPaka
        </Text>
        <Text className="mt-[9px] text-body-sm font-ui text-muted">
          Learn Japanese with one connected story.
        </Text>
      </View>

      <View className="gap-space-sm">
        <Button
          label="Start learning"
          onPress={() => router.replace('/onboarding/welcome')}
          className="w-full"
          testID="start-begin"
        />
        <Button
          label="Log in"
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

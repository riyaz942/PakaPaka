import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/common/ScreenHeader';
import { ItemDetailBody } from '@/components/learn/ItemDetailBody';
import { MaxContentWidth } from '@/constants/theme';

/**
 * Item detail body, shared by the Browse item route (`/browse/item/[id]`).
 * Extracted from the former `/learn/item/[id]` screen so discovery moving to
 * Browse did not fork the detail UI.
 *
 * Cross-references default to `/browse/item` links here (see `ItemLinkContext`).
 */
export function ItemDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const itemId = params.id ?? null;

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
            <ItemDetailBody itemId={itemId} />
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

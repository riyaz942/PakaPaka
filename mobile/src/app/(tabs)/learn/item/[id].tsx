import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import React from 'react';

/**
 * Rollout redirect: item details moved under Browse (FR62). Kept so links and
 * saved navigation state pointing at `/learn/item/[id]` keep working.
 */
export default function LearnItemRedirect() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  if (!id) {
    return <Redirect href="/browse" />;
  }

  return <Redirect href={`/browse/item/${id}` as Href} />;
}

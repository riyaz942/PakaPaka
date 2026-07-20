import { Redirect, useLocalSearchParams, type Href } from 'expo-router';
import React from 'react';

/**
 * Rollout redirect: the Read tab folded into Browse (FR63). Kept so existing
 * `/read/[id]` deep links (Home reading readiness shipped one in Story 2.2)
 * keep resolving.
 */
export default function ReadPassageRedirect() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  if (!id) {
    return <Redirect href="/browse" />;
  }

  return <Redirect href={`/browse/passage/${id}` as Href} />;
}
